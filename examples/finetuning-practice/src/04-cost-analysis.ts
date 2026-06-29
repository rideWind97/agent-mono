/**
 * ============================================================
 * Part 4: 成本与收益分析 —— 何时该微调？
 * ============================================================
 *
 * 微调不是银弹。在决定微调之前，需要回答三个问题：
 *
 *   1. Prompt Engineering 够不够用？
 *      → 如果好的 Prompt 就能解决，没必要微调
 *
 *   2. RAG 够不够用？
 *      → 如果问题是「缺少知识」，RAG 比微调更合适
 *
 *   3. 微调的投入产出比如何？
 *      → 数据准备成本 + 训练成本 + 维护成本 vs 收益
 *
 * 技术选型决策树：
 *
 *   问题是什么？
 *   ├── 模型不知道某些知识 → RAG（把知识检索给模型）
 *   ├── 模型能力够但格式/风格不对 → Prompt Engineering
 *   ├── Prompt 太长影响成本/延迟 → Fine-tuning（把 Prompt 「烧进」模型）
 *   └── 模型能力本身不够 → Fine-tuning 或 换更大模型
 *
 * 本文件：
 *   - 量化分析微调 vs Prompt Engineering 的成本对比
 *   - 构建决策辅助函数
 *   - 输出可视化的决策报告
 */

import { printSection, printStep } from "./config.js";

// ============================================================
// 价格数据（2024-2025 参考，实际以 OpenAI 官网为准）
// ============================================================

/**
 * OpenAI 模型定价（美元）
 *
 * 注意：价格会变动，使用前请查阅 https://openai.com/pricing
 */
const PRICING = {
  "gpt-4o": {
    input: 2.5 / 1_000_000,      // $2.50 / 1M input tokens
    output: 10.0 / 1_000_000,     // $10.00 / 1M output tokens
    finetuneTraining: 25.0 / 1_000_000,  // $25.00 / 1M training tokens
    finetuneInput: 3.75 / 1_000_000,     // 微调后 input 价格
    finetuneOutput: 15.0 / 1_000_000,    // 微调后 output 价格
  },
  "gpt-4o-mini": {
    input: 0.15 / 1_000_000,
    output: 0.6 / 1_000_000,
    finetuneTraining: 0.3 / 1_000_000,
    finetuneInput: 0.3 / 1_000_000,
    finetuneOutput: 1.2 / 1_000_000,
  },
} as const;

type ModelName = keyof typeof PRICING;

// ============================================================
// 成本计算器
// ============================================================

interface UsageScenario {
  /** 场景名称 */
  name: string;
  /** 每次请求的平均 input token 数 */
  avgInputTokens: number;
  /** 每次请求的平均 output token 数 */
  avgOutputTokens: number;
  /** 月请求量 */
  monthlyRequests: number;
}

interface TrainingConfig {
  /** 训练数据总 token 数 */
  totalTrainingTokens: number;
  /** 训练轮数 */
  epochs: number;
}

interface CostComparison {
  /** Prompt Engineering 方案：长 system prompt（无微调） */
  promptEngineering: {
    monthlyCost: number;
    inputTokensPerReq: number;
    detail: string;
  };
  /** Fine-tuning 方案：短 prompt + 微调模型 */
  fineTuning: {
    trainingCost: number;        // 一次性训练费
    monthlyCost: number;         // 月推理费
    inputTokensPerReq: number;
    detail: string;
  };
  /** 多少个月后微调方案开始省钱 */
  breakEvenMonths: number | null;
  recommendation: string;
}

/**
 * 计算 Prompt Engineering vs Fine-tuning 的成本对比
 *
 * Prompt Engineering 的隐性成本：
 *   - 长 system prompt 占用大量 input token（可能 500-2000 token）
 *   - 每次请求都要重复发送这些 token
 *   - 高频场景下，这笔费用很可观
 *
 * Fine-tuning 的优势：
 *   - 把 system prompt 的「知识」烧入模型权重
 *   - 推理时不需要长 prompt，节省 input token
 *   - 但有一次性的训练费用
 */
function compareCosts(
  model: ModelName,
  scenario: UsageScenario,
  training: TrainingConfig,
  systemPromptTokens: number
): CostComparison {
  const pricing = PRICING[model];

  // Prompt Engineering 方案：每次请求带完整 system prompt
  const peInputPerReq = scenario.avgInputTokens + systemPromptTokens;
  const peMonthlyCost =
    (peInputPerReq * pricing.input + scenario.avgOutputTokens * pricing.output) *
    scenario.monthlyRequests;

  // Fine-tuning 方案：训练一次，推理时 prompt 短很多
  const ftTrainingCost = training.totalTrainingTokens * training.epochs * pricing.finetuneTraining;
  const ftInputPerReq = scenario.avgInputTokens; // 不需要长 system prompt
  const ftMonthlyCost =
    (ftInputPerReq * pricing.finetuneInput + scenario.avgOutputTokens * pricing.finetuneOutput) *
    scenario.monthlyRequests;

  // 盈亏平衡点
  const monthlySaving = peMonthlyCost - ftMonthlyCost;
  const breakEvenMonths = monthlySaving > 0
    ? Math.ceil(ftTrainingCost / monthlySaving)
    : null;

  let recommendation: string;
  if (monthlySaving <= 0) {
    recommendation = "Prompt Engineering 更经济（微调后推理更贵或持平）";
  } else if (breakEvenMonths! <= 1) {
    recommendation = "强烈推荐微调（1 个月内回本）";
  } else if (breakEvenMonths! <= 3) {
    recommendation = "推荐微调（3 个月内回本）";
  } else if (breakEvenMonths! <= 6) {
    recommendation = "可以考虑微调（半年内回本），也要看格式/质量需求";
  } else {
    recommendation = "从纯成本角度不推荐微调，除非微调能显著提升质量";
  }

  return {
    promptEngineering: {
      monthlyCost: peMonthlyCost,
      inputTokensPerReq: peInputPerReq,
      detail: `${peInputPerReq} input + ${scenario.avgOutputTokens} output × ${scenario.monthlyRequests.toLocaleString()} 次/月`,
    },
    fineTuning: {
      trainingCost: ftTrainingCost,
      monthlyCost: ftMonthlyCost,
      inputTokensPerReq: ftInputPerReq,
      detail: `训练 $${ftTrainingCost.toFixed(2)} + 每月 ${ftInputPerReq} input + ${scenario.avgOutputTokens} output × ${scenario.monthlyRequests.toLocaleString()} 次/月`,
    },
    breakEvenMonths,
    recommendation,
  };
}

// ============================================================
// 决策树
// ============================================================

interface DecisionInput {
  /** 当前 Prompt Engineering 的效果满意吗 */
  promptSatisfactory: boolean;
  /** 问题是「缺少知识」还是「格式/风格不对」 */
  problemType: "lack_knowledge" | "format_style" | "capability";
  /** 月请求量 */
  monthlyRequests: number;
  /** 是否有高质量训练数据 */
  hasQualityData: boolean;
  /** 对延迟敏感吗 */
  latencySensitive: boolean;
}

function decideTechnique(input: DecisionInput): {
  recommendation: "prompt_engineering" | "rag" | "fine_tuning";
  reason: string;
} {
  // 如果 Prompt 就够用了，没必要微调
  if (input.promptSatisfactory) {
    return {
      recommendation: "prompt_engineering",
      reason: "当前 Prompt 效果已经满意，无需额外投入",
    };
  }

  // 如果问题是缺少知识 → RAG
  if (input.problemType === "lack_knowledge") {
    return {
      recommendation: "rag",
      reason: "问题是模型缺少特定知识，RAG（检索增强）是更好的方案",
    };
  }

  // 格式/风格问题 → 看是否有足够数据和请求量
  if (input.problemType === "format_style") {
    if (!input.hasQualityData) {
      return {
        recommendation: "prompt_engineering",
        reason: "缺少高质量训练数据，建议先优化 Prompt（Few-shot）",
      };
    }
    if (input.monthlyRequests < 1000) {
      return {
        recommendation: "prompt_engineering",
        reason: "月请求量较低，微调的 ROI 不高，建议优化 Prompt",
      };
    }
    return {
      recommendation: "fine_tuning",
      reason: "有高质量数据 + 高频调用 + 格式要求严格 → 微调是最佳方案",
    };
  }

  // 模型能力不足 → 微调或换更大模型
  if (input.hasQualityData && input.monthlyRequests > 5000) {
    return {
      recommendation: "fine_tuning",
      reason: "高频调用 + 有训练数据 → 微调小模型可能比用大模型更经济",
    };
  }

  return {
    recommendation: "prompt_engineering",
    reason: "建议先尝试更大模型 + 优化 Prompt，再考虑微调",
  };
}

// ============================================================
// 主函数
// ============================================================

async function main() {
  console.log("💰 Fine-tuning 实战 Part 4: 成本与收益分析\n");

  // ── 场景分析 ──
  printSection("场景成本对比");

  const scenarios: Array<{ model: ModelName; scenario: UsageScenario; systemPromptTokens: number }> = [
    {
      model: "gpt-4o-mini",
      scenario: {
        name: "低频内部工具",
        avgInputTokens: 200,
        avgOutputTokens: 300,
        monthlyRequests: 500,
      },
      systemPromptTokens: 800,
    },
    {
      model: "gpt-4o-mini",
      scenario: {
        name: "中频代码审查 Bot",
        avgInputTokens: 300,
        avgOutputTokens: 400,
        monthlyRequests: 10_000,
      },
      systemPromptTokens: 1200,
    },
    {
      model: "gpt-4o",
      scenario: {
        name: "高频客服系统",
        avgInputTokens: 150,
        avgOutputTokens: 200,
        monthlyRequests: 100_000,
      },
      systemPromptTokens: 1500,
    },
  ];

  const training: TrainingConfig = {
    totalTrainingTokens: 50_000,
    epochs: 3,
  };

  for (const { model, scenario, systemPromptTokens } of scenarios) {
    printStep("act", `\n📋 ${scenario.name} (${model})`);
    printStep("data", `  月请求量: ${scenario.monthlyRequests.toLocaleString()}`);
    printStep("data", `  System Prompt: ${systemPromptTokens} tokens`);

    const result = compareCosts(model, scenario, training, systemPromptTokens);

    console.log(`\n  Prompt Engineering:`);
    console.log(`    月费用: $${result.promptEngineering.monthlyCost.toFixed(2)}`);
    console.log(`    ${result.promptEngineering.detail}`);

    console.log(`  Fine-tuning:`);
    console.log(`    训练费: $${result.fineTuning.trainingCost.toFixed(2)}（一次性）`);
    console.log(`    月费用: $${result.fineTuning.monthlyCost.toFixed(2)}`);

    if (result.breakEvenMonths !== null) {
      console.log(`    回本周期: ${result.breakEvenMonths} 个月`);
    }
    printStep("result", `  建议: ${result.recommendation}`);
  }

  // ── 决策树演示 ──
  printSection("决策树：何时该微调？");

  const decisions: Array<{ label: string; input: DecisionInput }> = [
    {
      label: "场景 A: Prompt 效果已经很好",
      input: {
        promptSatisfactory: true,
        problemType: "format_style",
        monthlyRequests: 50_000,
        hasQualityData: true,
        latencySensitive: false,
      },
    },
    {
      label: "场景 B: 模型缺少行业知识",
      input: {
        promptSatisfactory: false,
        problemType: "lack_knowledge",
        monthlyRequests: 10_000,
        hasQualityData: false,
        latencySensitive: false,
      },
    },
    {
      label: "场景 C: 高频 + 格式要求严格 + 有数据",
      input: {
        promptSatisfactory: false,
        problemType: "format_style",
        monthlyRequests: 50_000,
        hasQualityData: true,
        latencySensitive: true,
      },
    },
    {
      label: "场景 D: 低频 + 无训练数据",
      input: {
        promptSatisfactory: false,
        problemType: "format_style",
        monthlyRequests: 200,
        hasQualityData: false,
        latencySensitive: false,
      },
    },
  ];

  for (const { label, input } of decisions) {
    const result = decideTechnique(input);
    const emoji = result.recommendation === "fine_tuning" ? "🔧"
      : result.recommendation === "rag" ? "📚" : "✏️";
    printStep("result", `${label}`);
    console.log(`    → ${emoji} ${result.recommendation.replace(/_/g, " ").toUpperCase()}`);
    console.log(`    理由: ${result.reason}\n`);
  }

  // ── 总结决策框 ──
  printSection("决策速查表");
  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  问题是「缺知识」？              → RAG（检索增强生成）       │
  │  Prompt 效果够好？              → Prompt Engineering        │
  │  格式/风格要求严格 + 高频调用？  → Fine-tuning               │
  │  没有训练数据？                  → 先收集数据，用 Prompt      │
  │  月请求量 < 1000？              → Prompt Engineering        │
  │  需要降低延迟？                  → Fine-tuning（短 prompt）  │
  └─────────────────────────────────────────────────────────────┘
  `);
}

main().catch((error) => {
  console.error("❌ 执行出错:", error.message || error);
  process.exit(1);
});
