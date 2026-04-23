/**
 * ============================================================
 * Part 1: 内容创作工作流 —— DAG（有向无环图）实战
 * ============================================================
 *
 * 工作流 vs Agent 的核心区别：
 *
 *   Agent：LLM 自主决定下一步做什么（动态路由）
 *          适合：开放性问题，需要灵活决策
 *
 *   工作流：开发者预定义好执行路径（静态或条件路由）
 *          适合：步骤明确、可预测的业务流程
 *
 * Anthropic 在《Building Effective Agents》中总结：
 *   "如果你的任务可以用流程图画出来，那就用工作流而不是 Agent"
 *
 * DAG（有向无环图）：
 *   - 有向：节点之间有明确的执行方向（A → B → C）
 *   - 无环：不会回到之前的节点（不允许死循环）
 *   - 每个节点是一个独立的处理步骤
 *
 * 本文件实现一个「内容创作工作流」：
 *
 *   调研(research) → 大纲(outline) → 撰写(draft) → 审核(review) → 输出
 *
 * 这是最经典的 DAG 工作流模式，在内容营销、技术文档、报告生成等
 * 场景中广泛使用。
 */

import { END, START, Annotation, StateGraph } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { createLLM, printSection, printStep } from "./config.js";

// ============================================================
// 第一步：用 Annotation 定义工作流状态
// ============================================================

/**
 * 工作流状态是所有节点之间传递数据的「共享黑板」
 *
 * 每个节点：
 *   - 读取 state 中需要的数据
 *   - 执行自己的逻辑
 *   - 返回要更新的字段（只返回变化的部分，框架自动合并）
 *
 * 设计技巧：
 *   - topic: 用户原始输入（只读参考）
 *   - 每个阶段有对应的输出字段（research → outline → draft → review）
 *   - steps 用于追踪执行轨迹（调试利器）
 */
const ContentState = Annotation.Root({
  /** 用户输入的写作主题 */
  topic: Annotation<string>(),
  /** 调研阶段输出：背景资料和关键事实 */
  research: Annotation<string>(),
  /** 大纲阶段输出：文章结构 */
  outline: Annotation<string>(),
  /** 撰写阶段输出：完整文章初稿 */
  draft: Annotation<string>(),
  /** 审核阶段输出：评审意见和修改建议 */
  review: Annotation<string>(),
  /** 最终输出 */
  finalArticle: Annotation<string>(),
  /** 执行轨迹追踪 */
  steps: Annotation<Array<{ node: string; summary: string; timestamp: string }>>(),
});

// ============================================================
// 第二步：定义每个工作流节点
// ============================================================

/** 辅助函数：记录步骤 */
function addStep(
  steps: typeof ContentState.State["steps"],
  node: string,
  summary: string
) {
  return [...steps, { node, summary, timestamp: new Date().toISOString() }];
}

/**
 * 节点 1：调研（Research）
 *
 * 工作流的第一步，负责收集主题相关的背景信息。
 * 在真实场景中，这个节点可以：
 * - 调用搜索引擎 API（Tavily、Google）
 * - 查询内部知识库（RAG 检索）
 * - 调用行业数据 API
 */
async function researchNode(state: typeof ContentState.State) {
  printStep("act", "📚 调研节点：收集背景资料...");

  const llm = createLLM({ temperature: 0.3 });
  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个资深调研员。请针对主题「{topic}」进行深度调研。

要求：
1. 提供 3-5 个关键事实或数据点
2. 列出该主题的核心概念
3. 指出当前的热点和趋势
4. 控制在 200 字以内

输出格式：
## 调研报告：{topic}
### 关键事实
...
### 核心概念
...
### 趋势洞察
...`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const research = await chain.invoke({ topic: state.topic });

  printStep("result", `调研完成（${research.length} 字）`);

  return {
    research,
    steps: addStep(state.steps, "research", `完成调研，产出 ${research.length} 字资料`),
  };
}

/**
 * 节点 2：大纲（Outline）
 *
 * 基于调研结果，规划文章的结构。
 * 这一步至关重要 —— 好的大纲决定了文章的逻辑和可读性。
 *
 * 注意：这个节点依赖 research 的输出
 * → 这就是 DAG 中「有向」的含义：数据沿固定方向流动
 */
async function outlineNode(state: typeof ContentState.State) {
  printStep("act", "📋 大纲节点：规划文章结构...");

  const llm = createLLM({ temperature: 0.2 });
  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个内容策划专家。基于以下调研资料，为主题「{topic}」设计文章大纲。

调研资料：
{research}

要求：
1. 设计 3-4 个主要章节
2. 每个章节包含 2-3 个要点
3. 标注每个章节的预计篇幅（短/中/长）
4. 确保逻辑递进、结构清晰

输出格式（Markdown）：
## 文章大纲：{topic}
### 一、[章节标题]（篇幅）
- 要点 1
- 要点 2
...`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const outline = await chain.invoke({
    topic: state.topic,
    research: state.research,
  });

  printStep("result", `大纲完成（${outline.length} 字）`);

  return {
    outline,
    steps: addStep(state.steps, "outline", `完成大纲，${outline.split("###").length - 1} 个章节`),
  };
}

/**
 * 节点 3：撰写（Draft）
 *
 * 基于调研和大纲，撰写完整的文章初稿。
 * 这是最消耗 LLM token 的节点，temperature 稍高以保持文采。
 */
async function draftNode(state: typeof ContentState.State) {
  printStep("act", "✍️ 撰写节点：撰写文章初稿...");

  const llm = createLLM({ temperature: 0.7 });
  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个技术写作专家。请根据调研资料和大纲，撰写一篇完整的文章。

主题：{topic}

调研资料：
{research}

文章大纲：
{outline}

写作要求：
1. 严格按照大纲结构展开
2. 每个要点都要有具体内容支撑
3. 使用通俗易懂的语言，避免过度专业术语
4. 适当加入示例和类比帮助理解
5. 控制在 500 字以内
6. 输出 Markdown 格式`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const draft = await chain.invoke({
    topic: state.topic,
    research: state.research,
    outline: state.outline,
  });

  printStep("result", `初稿完成（${draft.length} 字）`);

  return {
    draft,
    steps: addStep(state.steps, "draft", `完成初稿，共 ${draft.length} 字`),
  };
}

/**
 * 节点 4：审核（Review）
 *
 * 模拟人工审核 / AI 审核环节。
 * 审核员检查文章质量，给出评分和修改意见。
 *
 * 在真实系统中，审核节点可以：
 * - 接入人工审批（HITL，Part 3 会详细讲）
 * - 用另一个 LLM 做交叉审核（让 Claude 审核 GPT 的输出）
 * - 执行自动化检查（抄袭检测、事实核查）
 */
async function reviewNode(state: typeof ContentState.State) {
  printStep("act", "🔍 审核节点：检查文章质量...");

  const llm = createLLM({ temperature: 0.1 });
  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一个严格的内容审核编辑。请审核以下文章并给出评价。

文章标题：{topic}
文章内容：
{draft}

请从以下维度评分（1-10）并给出具体修改建议：
1. 内容准确性
2. 逻辑清晰度
3. 语言流畅性
4. 实用性

输出格式：
## 审核报告
### 评分
- 内容准确性：X/10
- 逻辑清晰度：X/10
- 语言流畅性：X/10
- 实用性：X/10
- **综合评分：X/10**

### 修改建议
1. ...
2. ...

### 审核结论
[通过 / 需修改 / 不通过]`
  );

  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const review = await chain.invoke({
    topic: state.topic,
    draft: state.draft,
  });

  printStep("result", `审核完成`);

  return {
    review,
    finalArticle: state.draft,
    steps: addStep(state.steps, "review", "完成审核评分"),
  };
}

// ============================================================
// 第三步：用 StateGraph 构建 DAG
// ============================================================

/**
 * 构建内容创作 DAG 工作流
 *
 * 拓扑：
 *   START → research → outline → draft → review → END
 *
 * 这是一个纯线性 DAG —— 每个节点严格按顺序执行。
 * Part 2 将引入条件分支，让工作流更灵活。
 */
function buildContentWorkflow() {
  return new StateGraph(ContentState)
    .addNode("research", researchNode)
    .addNode("outline", outlineNode)
    .addNode("draft", draftNode)
    .addNode("review", reviewNode)

    // 线性 DAG：每个节点有且仅有一个后继
    .addEdge(START, "research")
    .addEdge("research", "outline")
    .addEdge("outline", "draft")
    .addEdge("draft", "review")
    .addEdge("review", END)

    .compile();
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log("📝 Workflow 实战 Part 1: 内容创作工作流（DAG）\n");
  console.log("工作流拓扑: 调研 → 大纲 → 撰写 → 审核\n");

  const topics = [
    "AI Agent 在前端开发中的应用",
    "2025 年值得关注的 TypeScript 新特性",
  ];

  for (const topic of topics) {
    printSection(`创作主题: "${topic}"`);

    const workflow = buildContentWorkflow();
    const result = await workflow.invoke({
      topic,
      research: "",
      outline: "",
      draft: "",
      review: "",
      finalArticle: "",
      steps: [],
    });

    // 打印执行轨迹
    printStep("result", "\n📊 执行轨迹:");
    for (const step of result.steps) {
      console.log(`  [${step.node}] ${step.summary} (${step.timestamp})`);
    }

    printStep("result", `\n📄 审核报告:\n${result.review}`);
    console.log("\n" + "─".repeat(60));
  }
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
