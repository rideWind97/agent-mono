/**
 * ============================================================
 * Part 3: 微调效果评估 —— 基线对比与指标计算
 * ============================================================
 *
 * 「微调有没有效果？」需要严格的量化评估，不能凭感觉。
 *
 * 评估方法论：
 *
 *   1. 基线对比（A/B Test）
 *      - 基线：同一个问题让基座模型（未微调）回答
 *      - 实验：同一个问题让微调模型回答
 *      - 对比：在相同评估指标上衡量差异
 *
 *   2. 评估维度
 *      - 格式遵循度：是否按照要求的固定格式输出
 *      - 内容准确度：审查意见是否指出了真正的问题
 *      - 一致性：多次调用输出是否稳定
 *      - 延迟/成本：微调模型是否更快/更省
 *
 *   3. 自动评估 vs 人工评估
 *      - 自动：正则匹配格式、关键词检测、ROUGE 分数
 *      - 人工：标注员评分、盲评对比
 *      - LLM-as-Judge：用另一个强模型给两个输出打分
 *
 * 本文件演示：
 *   - 构建标准化测试集
 *   - 基座模型 vs 微调模型的 A/B 对比
 *   - 格式遵循度自动评分
 *   - LLM-as-Judge 质量评分
 */

import { createClient, config, printSection, printStep } from "./config.js";

// ============================================================
// 测试集（与训练集不重叠的样本）
// ============================================================

interface TestCase {
  id: string;
  code: string;
  expectedCategory: string;
  expectedSeverity: string;
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    id: "test-001",
    code: `const apiKey = "sk-proj-abc123xyz";\nfetch('/api', { headers: { Authorization: apiKey } });`,
    expectedCategory: "安全",
    expectedSeverity: "严重",
    description: "硬编码 API Key",
  },
  {
    id: "test-002",
    code: `function sum(arr) {\n  let total = 0;\n  arr.forEach(x => total += x);\n  return total;\n}`,
    expectedCategory: "最佳实践",
    expectedSeverity: "低",
    description: "forEach 副作用可用 reduce 替代",
  },
  {
    id: "test-003",
    code: `useEffect(() => {\n  const timer = setInterval(fetchData, 5000);\n}, []);`,
    expectedCategory: "错误处理",
    expectedSeverity: "高",
    description: "useEffect 缺少 cleanup 函数",
  },
  {
    id: "test-004",
    code: `app.post('/api/upload', (req, res) => {\n  const file = req.files.upload;\n  file.mv('/uploads/' + file.name);\n  res.send('ok');\n});`,
    expectedCategory: "安全",
    expectedSeverity: "严重",
    description: "文件上传未校验类型和路径",
  },
  {
    id: "test-005",
    code: `const data = await fetch(url).then(r => r.json());`,
    expectedCategory: "错误处理",
    expectedSeverity: "中",
    description: "fetch 无错误处理",
  },
];

// ============================================================
// 评估指标
// ============================================================

interface EvalResult {
  testId: string;
  model: string;
  output: string;
  metrics: {
    /** 格式遵循度：是否包含必要的格式元素 */
    formatScore: number;
    /** 类别匹配：是否正确识别问题类别 */
    categoryMatch: boolean;
    /** 严重程度匹配 */
    severityMatch: boolean;
    /** 输出长度（字符） */
    outputLength: number;
    /** 响应延迟（ms） */
    latencyMs: number;
  };
}

/**
 * 格式遵循度评分
 *
 * 检查输出是否包含预定义的结构元素：
 *   - "## 审查结果" 标题
 *   - "严重程度" 字段
 *   - "类别" 字段
 *   - "## 问题描述" 标题
 *   - "## 建议修改" 标题
 *
 * 每命中一个得 20 分，满分 100
 */
function scoreFormat(output: string): number {
  const checks = [
    /##\s*审查结果/,
    /严重程度[：:]/,
    /类别[：:]/,
    /##\s*问题描述/,
    /##\s*建议修改/,
  ];
  const hits = checks.filter((re) => re.test(output)).length;
  return Math.round((hits / checks.length) * 100);
}

/**
 * 类别匹配检查
 */
function matchCategory(output: string, expected: string): boolean {
  return output.includes(expected);
}

/**
 * 严重程度匹配
 */
function matchSeverity(output: string, expected: string): boolean {
  return output.includes(expected);
}

// ============================================================
// 运行评估
// ============================================================

/**
 * 调用模型进行代码审查
 */
async function runReview(
  modelId: string,
  code: string
): Promise<{ output: string; latencyMs: number }> {
  const client = createClient();
  const start = Date.now();

  const response = await client.chat.completions.create({
    model: modelId,
    messages: [
      {
        role: "system",
        content: `你是一个专业的代码审查助手。请按以下固定格式输出审查意见：

## 审查结果
- 严重程度：[低/中/高/严重]
- 类别：[安全/性能/可读性/最佳实践/错误处理]

## 问题描述
[一句话描述问题]

## 建议修改
[给出具体的修改方案]`,
      },
      {
        role: "user",
        content: `请审查以下代码：\n\n\`\`\`\n${code}\n\`\`\``,
      },
    ],
    temperature: 0,
    max_tokens: 500,
  });

  return {
    output: response.choices[0]?.message?.content || "",
    latencyMs: Date.now() - start,
  };
}

/**
 * 对单个测试用例运行评估
 */
async function evalTestCase(
  modelId: string,
  testCase: TestCase
): Promise<EvalResult> {
  const { output, latencyMs } = await runReview(modelId, testCase.code);

  return {
    testId: testCase.id,
    model: modelId,
    output,
    metrics: {
      formatScore: scoreFormat(output),
      categoryMatch: matchCategory(output, testCase.expectedCategory),
      severityMatch: matchSeverity(output, testCase.expectedSeverity),
      outputLength: output.length,
      latencyMs,
    },
  };
}

/**
 * 汇总评估结果
 */
function summarizeResults(results: EvalResult[]): {
  avgFormatScore: number;
  categoryAccuracy: number;
  severityAccuracy: number;
  avgLatencyMs: number;
  avgLength: number;
} {
  const n = results.length;
  return {
    avgFormatScore: Math.round(results.reduce((s, r) => s + r.metrics.formatScore, 0) / n),
    categoryAccuracy: Math.round((results.filter((r) => r.metrics.categoryMatch).length / n) * 100),
    severityAccuracy: Math.round((results.filter((r) => r.metrics.severityMatch).length / n) * 100),
    avgLatencyMs: Math.round(results.reduce((s, r) => s + r.metrics.latencyMs, 0) / n),
    avgLength: Math.round(results.reduce((s, r) => s + r.metrics.outputLength, 0) / n),
  };
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log("📊 Fine-tuning 实战 Part 3: 效果评估\n");
  console.log(`测试集: ${TEST_CASES.length} 条用例\n`);

  // 基线模型评估
  const baseModel = config.baseModel;
  // 微调模型（如果有的话；没有则跳过对比）
  const ftModel = process.env.FINETUNED_MODEL_ID || "";

  printSection(`基线模型评估: ${baseModel}`);

  const baseResults: EvalResult[] = [];
  for (const tc of TEST_CASES) {
    printStep("act", `[${tc.id}] ${tc.description}...`);
    try {
      const result = await evalTestCase(baseModel, tc);
      baseResults.push(result);
      printStep("result",
        `格式=${result.metrics.formatScore}% | ` +
        `类别=${result.metrics.categoryMatch ? "✅" : "❌"} | ` +
        `严重度=${result.metrics.severityMatch ? "✅" : "❌"} | ` +
        `${result.metrics.latencyMs}ms`
      );
    } catch (error) {
      printStep("error", `${tc.id} 失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 汇总基线
  if (baseResults.length > 0) {
    const baseSummary = summarizeResults(baseResults);
    printSection("基线模型汇总");
    console.log(`  格式遵循度:   ${baseSummary.avgFormatScore}%`);
    console.log(`  类别准确率:   ${baseSummary.categoryAccuracy}%`);
    console.log(`  严重度准确率: ${baseSummary.severityAccuracy}%`);
    console.log(`  平均延迟:     ${baseSummary.avgLatencyMs}ms`);
    console.log(`  平均输出长度: ${baseSummary.avgLength} 字符`);
  }

  // 微调模型评估（如果提供了模型 ID）
  if (ftModel) {
    printSection(`微调模型评估: ${ftModel}`);

    const ftResults: EvalResult[] = [];
    for (const tc of TEST_CASES) {
      printStep("act", `[${tc.id}] ${tc.description}...`);
      try {
        const result = await evalTestCase(ftModel, tc);
        ftResults.push(result);
        printStep("result",
          `格式=${result.metrics.formatScore}% | ` +
          `类别=${result.metrics.categoryMatch ? "✅" : "❌"} | ` +
          `严重度=${result.metrics.severityMatch ? "✅" : "❌"} | ` +
          `${result.metrics.latencyMs}ms`
        );
      } catch (error) {
        printStep("error", `${tc.id} 失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (ftResults.length > 0 && baseResults.length > 0) {
      const ftSummary = summarizeResults(ftResults);
      const baseSummary = summarizeResults(baseResults);

      printSection("A/B 对比结果");
      const diff = (a: number, b: number) => {
        const d = a - b;
        return d > 0 ? `+${d}` : `${d}`;
      };
      console.log(`  指标             基线     微调     差异`);
      console.log(`  ─────────────────────────────────────────`);
      console.log(`  格式遵循度       ${baseSummary.avgFormatScore}%     ${ftSummary.avgFormatScore}%     ${diff(ftSummary.avgFormatScore, baseSummary.avgFormatScore)}%`);
      console.log(`  类别准确率       ${baseSummary.categoryAccuracy}%     ${ftSummary.categoryAccuracy}%     ${diff(ftSummary.categoryAccuracy, baseSummary.categoryAccuracy)}%`);
      console.log(`  严重度准确率     ${baseSummary.severityAccuracy}%     ${ftSummary.severityAccuracy}%     ${diff(ftSummary.severityAccuracy, baseSummary.severityAccuracy)}%`);
      console.log(`  平均延迟         ${baseSummary.avgLatencyMs}ms   ${ftSummary.avgLatencyMs}ms   ${diff(ftSummary.avgLatencyMs, baseSummary.avgLatencyMs)}ms`);
    }
  } else {
    printStep("think", "\n未设置 FINETUNED_MODEL_ID 环境变量，跳过微调模型对比");
    printStep("think", "微调完成后设置 FINETUNED_MODEL_ID=ft:xxx 再运行此脚本做 A/B 对比");
  }
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
