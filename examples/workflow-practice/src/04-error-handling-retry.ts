/**
 * ============================================================
 * Part 4: 错误处理与重试 —— 让工作流具备「韧性」
 * ============================================================
 *
 * 生产环境中的 AI 工作流会遇到各种故障：
 *   - LLM API 超时或限流（429 Too Many Requests）
 *   - 网络中断（ECONNRESET）
 *   - LLM 输出格式不符合预期（JSON 解析失败）
 *   - 外部工具服务不可用
 *
 * 鲁棒的错误处理策略：
 *
 *   1. 重试（Retry）
 *      - 指数退避：每次失败后等待时间翻倍（200ms → 400ms → 800ms）
 *      - 限制最大重试次数（防止长时间卡住）
 *      - 只对可重试错误执行重试（超时/网络错误可重试，参数错误不可重试）
 *
 *   2. 降级（Fallback）
 *      - LLM 调用失败 → 使用缓存/默认值
 *      - 高级模型失败 → 切换到低级模型
 *      - 在线工具失败 → 使用本地备份
 *
 *   3. 补偿（Compensation）
 *      - 工作流中间步骤失败 → 回滚已完成的操作
 *      - 例如：支付成功但发货失败 → 自动退款
 *
 * 本文件用 StateGraph 实现：
 *   - 节点级重试（带指数退避）
 *   - 模型降级（主模型→备用模型）
 *   - 错误捕获与工作流恢复
 */

import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { createLLM, printSection, printStep } from "./config.js";

// ============================================================
// 工具函数：重试与退避
// ============================================================

/**
 * 指数退避重试
 *
 * 算法：每次失败后，等待时间 = baseDelay * 2^attempt
 *   attempt 0: 等待 200ms
 *   attempt 1: 等待 400ms
 *   attempt 2: 等待 800ms
 *
 * 为什么用指数退避而非固定间隔？
 *   - 给服务端恢复的时间（如果是限流，固定间隔可能不断触发限流）
 *   - 避免「雷群效应」（大量客户端同时重试导致服务端雪崩）
 */
async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 200, onRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw new Error(`${label} 在 ${maxRetries + 1} 次尝试后仍然失败: ${err.message}`);
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      onRetry?.(attempt, err);
      printStep("retry", `${label} 失败（${err.message}），${delay}ms 后第 ${attempt + 2} 次尝试...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("unreachable");
}

/**
 * 判断错误是否可重试
 *
 * 可重试：超时、网络错误、限流
 * 不可重试：参数错误、认证失败、资源不存在
 */
function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /timeout/i,
    /ECONNRESET/i,
    /429/,
    /rate limit/i,
    /503/,
    /ENOTFOUND/i,
    /network/i,
  ];
  return retryablePatterns.some((p) => p.test(error.message));
}

// ============================================================
// 状态定义
// ============================================================

const RobustState = Annotation.Root({
  topic: Annotation<string>(),
  research: Annotation<string>(),
  draft: Annotation<string>(),
  /** 各节点的执行状态 */
  nodeStatus: Annotation<Record<string, "success" | "failed" | "fallback">>(),
  /** 错误日志 */
  errors: Annotation<Array<{ node: string; error: string; retryCount: number }>>(),
  steps: Annotation<Array<{ node: string; detail: string }>>(),
});

function addStep(steps: typeof RobustState.State["steps"], node: string, detail: string) {
  return [...steps, { node, detail }];
}

// ============================================================
// 模拟不稳定的外部服务
// ============================================================

let callCount = 0;

/**
 * 模拟一个不稳定的外部搜索 API
 *
 * 前 2 次调用会失败（模拟网络抖动），第 3 次成功。
 * 用于演示重试机制。
 */
async function unstableSearchAPI(query: string): Promise<string> {
  callCount++;
  if (callCount <= 2) {
    throw new Error("ECONNRESET: 连接被重置（模拟网络故障）");
  }
  return `搜索结果：找到 3 篇关于「${query}」的资料 [模拟数据]`;
}

// ============================================================
// 节点定义
// ============================================================

/**
 * 节点 1: 调研（带重试）
 *
 * 调用外部搜索 API，可能失败。
 * 失败后自动重试，最多 3 次。
 * 如果重试全部失败，降级为使用本地默认数据。
 */
async function researchWithRetry(state: typeof RobustState.State) {
  printStep("act", "📚 调研节点（带重试）...");

  let research: string;
  let status: "success" | "fallback" = "success";
  const errors: typeof RobustState.State["errors"] = [];

  try {
    research = await withRetry(
      "外部搜索 API",
      () => unstableSearchAPI(state.topic),
      {
        maxRetries: 3,
        baseDelayMs: 200,
        onRetry: (attempt, error) => {
          errors.push({ node: "research", error: error.message, retryCount: attempt + 1 });
        },
      }
    );
  } catch (error) {
    // 重试全部失败 → 降级
    const errMsg = error instanceof Error ? error.message : String(error);
    printStep("error", `调研 API 彻底失败: ${errMsg}`);
    printStep("think", "降级为本地默认数据...");

    research = `[降级数据] 主题「${state.topic}」的基础概述：这是一个重要的技术话题，涵盖多个核心概念。`;
    status = "fallback";
    errors.push({ node: "research", error: errMsg, retryCount: 4 });
  }

  printStep("result", `调研完成（${status === "fallback" ? "降级模式" : "正常模式"}）`);

  return {
    research,
    nodeStatus: { ...state.nodeStatus, research: status },
    errors: [...state.errors, ...errors],
    steps: addStep(state.steps, "research", `完成调研（${status}），${errors.length} 次错误`),
  };
}

/**
 * 节点 2: 撰写（带模型降级）
 *
 * 先尝试用主模型，如果失败则切换到备用模型。
 * 模型降级是常见的高可用策略：
 *   GPT-4o 超时 → 切换到 GPT-4o-mini（更快但能力稍弱）
 */
async function draftWithFallback(state: typeof RobustState.State) {
  printStep("act", "✍️ 撰写节点（带模型降级）...");

  const prompt = ChatPromptTemplate.fromTemplate(
    `基于以下资料，围绕「{topic}」撰写一段 200 字以内的短文。

资料：
{research}

输出 Markdown 格式。`
  );

  // 模型优先级：主模型 → 备用模型
  const modelCandidates = [
    { model: undefined, label: "主模型" },     // 使用 config 默认模型
    { model: "gpt-4o-mini", label: "备用模型" },
  ];

  let draft = "";
  let status: "success" | "fallback" = "success";

  for (let i = 0; i < modelCandidates.length; i++) {
    const candidate = modelCandidates[i]!;
    try {
      printStep("think", `尝试 ${candidate.label}...`);
      const llm = createLLM({ model: candidate.model });
      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      draft = await chain.invoke({ topic: state.topic, research: state.research });
      if (i > 0) status = "fallback";
      break;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      printStep("error", `${candidate.label}失败: ${errMsg}`);
      if (i === modelCandidates.length - 1) {
        draft = `[生成失败] 无法为主题「${state.topic}」生成内容。所有模型均不可用。`;
        status = "fallback";
      }
    }
  }

  printStep("result", `撰写完成（${status}，${draft.length} 字）`);

  return {
    draft,
    nodeStatus: { ...state.nodeStatus, draft: status },
    steps: addStep(state.steps, "draft", `完成撰写（${status}）`),
  };
}

/**
 * 节点 3: 结果验证与格式检查
 *
 * 在输出前做最后的质量检查：
 * - 内容是否为空
 * - 长度是否合理
 * - 是否包含降级标记
 */
async function validateNode(state: typeof RobustState.State) {
  printStep("act", "✅ 验证节点...");

  const issues: string[] = [];

  if (!state.draft || state.draft.length < 10) {
    issues.push("内容为空或过短");
  }
  if (state.draft.includes("[降级数据]") || state.draft.includes("[生成失败]")) {
    issues.push("内容包含降级/失败标记");
  }

  const hasErrors = state.errors.length > 0;
  const allSuccess = Object.values(state.nodeStatus).every((s) => s === "success");

  printStep("result", `验证完成: ${issues.length} 个问题, ${state.errors.length} 个历史错误, 全部成功: ${allSuccess}`);

  return {
    steps: addStep(
      state.steps,
      "validate",
      `验证: ${issues.length === 0 ? "通过" : issues.join(", ")}`
    ),
  };
}

// ============================================================
// 构建鲁棒工作流
// ============================================================

function buildRobustWorkflow() {
  return new StateGraph(RobustState)
    .addNode("research", researchWithRetry)
    .addNode("draft", draftWithFallback)
    .addNode("validate", validateNode)

    .addEdge(START, "research")
    .addEdge("research", "draft")
    .addEdge("draft", "validate")
    .addEdge("validate", END)

    .compile();
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log("🛡️ Workflow 实战 Part 4: 错误处理与重试\n");
  console.log("策略：指数退避重试 + 模型降级 + 结果验证\n");

  printSection("场景: 外部 API 不稳定（前 2 次失败，第 3 次成功）");

  // 重置计数器
  callCount = 0;

  const workflow = buildRobustWorkflow();
  const result = await workflow.invoke({
    topic: "前端工程化最佳实践",
    research: "",
    draft: "",
    nodeStatus: {},
    errors: [],
    steps: [],
  });

  printStep("result", "\n📊 执行轨迹:");
  for (const step of result.steps) {
    console.log(`  [${step.node}] ${step.detail}`);
  }

  if (result.errors.length > 0) {
    printStep("error", "\n⚠️ 错误日志:");
    for (const err of result.errors) {
      console.log(`  [${err.node}] 第 ${err.retryCount} 次: ${err.error}`);
    }
  }

  printStep("result", `\n节点状态: ${JSON.stringify(result.nodeStatus)}`);
  printStep("result", `最终内容（${result.draft.length} 字）:\n${result.draft.slice(0, 200)}...`);
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
