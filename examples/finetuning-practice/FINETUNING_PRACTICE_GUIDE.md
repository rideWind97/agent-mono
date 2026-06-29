# 🔧 模型微调（Fine-tuning）—— 完整实战学习指南

> 对应学习计划 **第十章：模型微调（Fine-tuning）**  
> 技术栈：TypeScript + OpenAI API（Files / Fine-tuning / Chat Completions）  
> 路径：`examples/finetuning-practice/`

---

## 📋 目录

| Part | 主题 | 核心知识点 | 文件 |
|------|------|------------|------|
| 1 | [数据集准备](#part-1-微调数据集准备) | JSONL、`messages` 结构、清洗与验证、训练/验证拆分 | `01-dataset-preparation.ts` |
| 2 | [Fine-tuning API 全流程](#part-2-openai-fine-tuning-api) | 上传文件、创建 job、轮询、事件、调用微调模型 | `02-finetune-api.ts` |
| 3 | [效果评估](#part-3-效果评估) | 基线 vs 微调、格式与内容指标、A/B 对比 | `03-evaluation.ts` |
| 4 | [成本与收益](#part-4-成本与收益分析) | Prompt 成本、训练成本、何时值得微调 | `04-cost-analysis.ts` |

---

## 🚀 快速开始

```bash
# 1. 在仓库根目录已加入 workspace 时，安装依赖
cd /path/to/agent-mono
pnpm install

# 2. 进入示例目录并配置环境变量
cd examples/finetuning-practice
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY、OPENAI_BASE_URL（若用兼容端点）
# 可选：OPENAI_MODEL、FINETUNED_MODEL_ID（Part 3 做对比时用）

# 3. 运行
pnpm run demo:all              # 或: npx tsx src/run-all.ts
npx tsx src/run-all.ts 1 3     # 只跑 Part 1 与 3
pnpm run demo:dataset          # 单独 Part 1
```

---

## 🏗️ 项目架构

```
examples/finetuning-practice/
├── src/
│   ├── config.ts                    # 环境、createClient、日志辅助
│   ├── 01-dataset-preparation.ts   # Part 1: JSONL 与数据质量
│   ├── 02-finetune-api.ts          # Part 2: 上传 → job → 轮询（默认 DRY RUN）
│   ├── 03-evaluation.ts            # Part 3: 基线/微调评估
│   ├── 04-cost-analysis.ts         # Part 4: 成本与决策
│   └── run-all.ts                  # 统一运行器（可选 1–4）
├── data/                           # Part 1 生成（运行后出现）
│   ├── train.jsonl
│   ├── valid.jsonl
│   └── all.jsonl
├── package.json
├── tsconfig.json
├── .env.example
└── FINETUNING_PRACTICE_GUIDE.md    # 本文件
```

---

## 前置知识：何时微调？

| 手段 | 适用场景 | 本示例侧重 |
|------|----------|------------|
| **Prompt** | 格式/风格可通过说明词稳定约束 | 基线对比 |
| **RAG** | 知识在外部、需频繁更新 | 未实现（可自学接向量库） |
| **微调** | 需要稳定「输入→输出」映射、强格式、大量同类任务、数据可批量标注 | **代码审查固定模板** |

> 本仓库用「代码审查 + 固定 Markdown 结构」展示微调价值：比单纯 Prompt 更容易量化「格式是否遵循」。

---

## Part 1: 微调数据集准备

### 核心概念

- **JSONL**：每行一个独立 JSON 对象，对应一条训练样本。  
- **与 Chat 对齐**：每条样本含 `messages: [{ role, content }, ...]`，与 Chat Completions 一致。  
- **质量 > 数量**：本示例内置 **50 条** 手写字段样本（安全、性能、可读性、错误处理等），满足「至少 50 条」的练习门槛；真实项目通常需要更多、且持续迭代。

### 本文件在做什么

1. 用统一的 `system` 提示，约束输出为「严重程度 / 类别 / 问题 / 建议」四段。  
2. 校验每条是否有 system / user / assistant、长度是否离谱。  
3. **80/20** 随机拆成 `train.jsonl` 与 `valid.jsonl`（可改比例）。  
4. 粗略打印训练 Token 与**参考**美元成本（具体单价以 [OpenAI 定价页](https://openai.com/pricing) 为准）。

### 学习要点

1. 微调数据不是「越杂越好」，**输出分布要和你上线场景一致**。  
2. 验证集虽不参与 OpenAI 托管微调的官方「调参」流程，但**本地**应用它做离线评估（Part 3）很有价值。  
3. 修改 `SAMPLES` 时保持 **assistant 格式与 Part 3 的解析器** 一致，否则指标会失真。

---

## Part 2: OpenAI Fine-tuning API

### 流程

```
训练 JSONL → files.create (purpose: fine-tune) → fineTuning.jobs.create
     → 轮询 retrieve → listEvents 看 loss/日志 → 使用 fine_tuned_model
```

### DRY RUN（重要）

- 默认 **不**调用真实上传与训练，**不产生费用**。  
- 要跑真微调：在环境中设置 `ACTUALLY_RUN_FINETUNE=true`，并确保先执行 Part 1 生成 `data/train.jsonl`。  
- 真实训练常需 **10–60+ 分钟**，需稳定网络与有效 API Key/配额。

### 本文件在做什么

1. 读 `data/train.jsonl` 行数。  
2. 非 DRY 时：上传、创建 job、`n_epochs` 等超参、轮询到 `succeeded`/`failed`。  
3. 拉取训练事件、用**微调后模型**做一次 `chat.completions` 试跑。  

### 学习要点

1. 基座模型在 `config.baseModel`（`OPENAI_MODEL`），需与 [官方支持的微调基座](https://platform.openai.com/docs/guides/fine-tuning) 一致。  
2. 任务状态：`validating_files` → `queued` → `running` → `succeeded` / `failed` / `cancelled`。  
3. **suffix** 便于在控制台里区分产出的 `ft:...` 名称。

---

## Part 3: 效果评估

### 基线 vs 微调

- **基线**：`OPENAI_MODEL` 指向的**未**微调模型。  
- **对比**：在 `.env` 中设置 `FINETUNED_MODEL_ID=ft:...`（完成 Part 2 后平台给出的 ID），对同一组测试用例跑两遍并对比指标。  
- 指标包含：是否含「审查结果/问题/建议」结构、**类别/严重程度** 是否与参考答案一致等（见源码注释与输出）。

### 学习要点

1. 没有离线指标就不要宣称「微调一定更好」——**数据偏差**会导致负迁移。  
2. 分类标签尽量与数据里的枚举一致，便于算准确率。  
3. 温度建议 **0 或近 0**，减少随机性，便于复现实验。

---

## Part 4: 成本与收益分析

### 在比什么

- **推理**：全量 system + few-shot 的长 Prompt vs 更短的 Prompt + 微调后模型习惯。  
- **训练**：一次性 `训练 tokens × epochs` × 训练单价。  
- 本文件用**可替换的参考单价**做示意，**务必**用你账号所在区域的**当前**价格与**实际** `usage` 替换。

### 学习要点

1. 低调用量时，往往是 **Prompt 更便宜**；高调用、强格式、少 Token 时微调可能摊薄成本。  
2. 将「人力标注与维护数据」计进 TCO，而不仅是 API 美元。

---

## ❓ 常见问题

**Q: 报缺少 OPENAI_API_KEY**  
A: 在 `examples/finetuning-practice/.env` 或仓库根目录 `.env` 中设置（`config` 会尝试读取上级 `.env`）。

**Q: Part 2 的 `File` 上传报错**  
A: 需要 **Node 18+**（全局 `File`）与已安装的 `openai` 包；如仍失败，可查阅 SDK 文档中 `toFile` / 流式上传的写法。

**Q: 与第八章 workflow-practice 的关系**  
A: 第八章是 **LangGraph 编排**；第十章是 **模型层行为** 从数据学习。可先后独立学习，不必同一项目混写。

---

## 📚 延伸阅读（与 `LEARNING_PLAN.md` 一致）

- [OpenAI Fine-tuning Guide](https://platform.openai.com/docs/guides/fine-tuning)  
- 吴恩达 [Finetuning Large Language Models](https://www.deeplearning.ai/short-courses/finetuning-large-language-models/)  
- 开源侧：Hugging Face PEFT（LoRA）、Unsloth、LLaMA-Factory —— 与 OpenAI 托管 API 流程不同，但**数据与评估思维**通用。

祝学习顺利。若你扩展了自有数据集或评估器，保持 Part 1 的 JSONL 契约与 Part 3 的解析规则同步即可。
