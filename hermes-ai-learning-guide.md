# Hermes AI 一周学习指南

> 本指南中的 Hermes 指 Nous Research 的 Hermes 系列 AI 模型与 Hermes Agent，不是 React Native 的 Hermes JavaScript 引擎。

## 学习目标

一周内不追求读完源码或完全掌握大模型训练细节，而是掌握 Hermes AI 的重要知识点，并能在实际项目中完成基本选型、调用、部署和 Agent 实验。

一周后你应该能够：

- 解释 Hermes 是什么，以及它和 Llama、Nous Research 的关系。
- 区分 Hermes Models 和 Hermes Agent。
- 理解 Hermes 3、Hermes 4 等版本的定位。
- 掌握 Prompt、多轮对话、推理模式和工具调用的基本用法。
- 了解本地部署、API 调用、量化模型和推理成本。
- 能用 Hermes 做一个简单 AI 助手或工具调用 Demo。

## Hermes 是什么

Hermes 是 Nous Research 发布的一系列大语言模型，主要面向指令跟随、多轮对话、推理、角色扮演、创作和工具调用场景。

它通常不是从零训练的基础模型，而是在 Llama 等基础模型之上进行微调得到的指令模型。例如 Hermes 3 就基于 Llama 3.1 系列进行微调。

需要区分两个概念：

- **Hermes Models**：Nous Research 的大语言模型系列，例如 Hermes 3、Hermes 4。
- **Hermes Agent**：Nous Research 的开源 Agent 应用或框架，强调工具使用、本地/自托管和长期协作。

## 一周学习计划总览

| 天数 | 主题 | 目标 |
| --- | --- | --- |
| 第 1 天 | 基础认知 | 知道 Hermes 是什么，理解模型家族定位 |
| 第 2 天 | 核心能力 | 掌握指令跟随、多轮对话、创作、推理、工具调用 |
| 第 3 天 | 版本与选型 | 理解 Hermes 3、Hermes 4、8B、70B、405B 等区别 |
| 第 4 天 | Prompt 与工具调用 | 能写基础 Prompt，并理解 function calling |
| 第 5 天 | 部署与推理 | 了解 API、本地部署、量化和推理成本 |
| 第 6 天 | Hermes Agent | 理解 Agent 的任务执行流程 |
| 第 7 天 | 综合实战 | 做一个小 Demo，把知识串起来 |

## 第 1 天：认识 Hermes 是什么

### 学习目标

搞清楚 Hermes 在 AI 生态里的位置。

### 学习内容

- Hermes 是 Nous Research 的 LLM 系列。
- Hermes 3 基于 Llama 3.1 系列微调，包括 8B、70B、405B 等版本。
- Hermes 4 继续强化推理、创作、工具调用和 hybrid reasoning。
- Hermes 更偏向指令微调、对话和 Agent 场景，而不是基础模型。

### 重点概念

```text
基础模型：Llama / Mistral 等
微调模型：Hermes
应用形态：聊天、工具调用、Agent、角色扮演、本地部署
```

### 实践任务

- 阅读 Hermes 官方介绍和模型卡。
- 找到 Hermes 3 或 Hermes 4 在 Hugging Face 上的模型页面。
- 用自己的话写一段 200 字总结：Hermes 是什么，适合做什么。

## 第 2 天：理解 Hermes 的核心能力

### 学习目标

知道 Hermes 强在哪里。

### 学习内容

- 指令跟随能力。
- 多轮对话能力。
- 长上下文一致性。
- 角色扮演和创作能力。
- Function calling / tool use。
- Reasoning mode / hybrid reasoning。

### 重点理解

Hermes 的定位不是简单替代所有商业闭源模型，而是一个更开放、更可控、适合本地部署和 Agent 实验的模型系列。

### 实践任务

- 用同一个问题测试 Hermes 和其他模型。
- 对比它们在推理、写作、工具调用上的表现。
- 记录 Hermes 在哪些场景表现更自然，哪些地方容易失败。

## 第 3 天：学习模型家族与版本选型

### 学习目标

搞清楚不同 Hermes 版本怎么选。

### 重点版本

- **Hermes 3 8B**：适合轻量本地实验。
- **Hermes 3 70B**：能力更强，但硬件要求高。
- **Hermes 3 405B**：大规模版本，通常更适合通过 API 使用。
- **Hermes 4 70B**：更偏推理和工具调用。
- **Hermes 4 405B**：能力更强，成本更高。
- **Hermes 4.3 36B**：偏本地部署场景。

### 选型逻辑

```text
本地轻量学习：8B / 14B / 36B
认真测试能力：70B
追求最强效果：405B
Agent / 工具调用：优先看 Hermes 4
```

### 实践任务

- 列出你当前机器或服务器配置。
- 判断适合本地跑哪类模型。
- 如果硬件不足，选择 API 方案进行体验。

## 第 4 天：掌握 Prompt 与工具调用

### 学习目标

会用 Hermes，而不是只知道它是什么。

### 学习内容

- System prompt 怎么写。
- User prompt 怎么拆任务。
- 多轮上下文怎么维护。
- Function calling 的基本格式。
- Agent 场景中如何让模型选择工具。

### 练习任务

1. 写一个普通聊天 prompt。
2. 写一个带角色设定的 prompt。
3. 写一个要求模型分步骤推理的 prompt。
4. 写一个模拟工具调用的 prompt。
5. 测试模型是否能稳定遵守系统指令。

### 观察指标

- 是否听从 system prompt。
- 是否会自作主张。
- 是否能保持角色。
- 是否能按 JSON/schema 输出。
- 是否能在多轮对话中保持一致。

## 第 5 天：学习本地部署与推理

### 学习目标

知道怎么跑 Hermes。

### 学习内容

- Hugging Face 模型卡。
- Transformers 推理。
- vLLM / llama.cpp / Ollama / LM Studio 等运行方式。
- 量化模型：GGUF、AWQ、GPTQ。
- 显存、上下文长度、推理速度之间的取舍。

### 重点理解

```text
模型参数越大，能力通常越强，但成本越高。
量化越重，越省资源，但可能损失质量。
上下文越长，显存和推理成本越高。
```

### 实践建议

- 电脑配置一般：先用 API 或 8B/14B 量化模型。
- 有较强 GPU：尝试 70B 量化或云端推理。
- 想做产品：优先 API + 工具调用测试。

## 第 6 天：学习 Hermes Agent

### 学习目标

理解 Hermes 不只是模型，也可以作为 Agent 使用。

### 学习内容

- Hermes Agent 是 Nous Research 的开源 Agent。
- 它强调本地/自托管、工具使用、长期协作。
- 可以和桌面应用、终端、外部服务结合。
- Agent 的核心不是聊天，而是计划、调用工具、执行任务、反馈结果。

### Agent 基本流程

```text
用户目标
  -> 模型理解任务
  -> 拆解步骤
  -> 选择工具
  -> 执行工具
  -> 观察结果
  -> 继续迭代
  -> 给出最终答案
```

### 实践任务

- 阅读 Hermes Agent 官方介绍。
- 了解它能接入哪些工具或运行环境。
- 画出一个你想用 Agent 完成的任务流程。

## 第 7 天：综合实战

### 学习目标

做一个小项目，把前六天的知识串起来。

### 推荐项目 A：Hermes AI 学习助手

功能要求：

- 输入学习主题。
- Hermes 输出学习计划。
- 支持阶段任务拆解。
- 能根据用户反馈调整计划。

适合目标：

- 想快速掌握 Prompt 和多轮对话。
- 想做一个简单但完整的 AI 应用。

### 推荐项目 B：Hermes 工具调用 Demo

功能要求：

- 用户提出天气、网页、文件或代码相关问题。
- Hermes 判断是否需要工具。
- 输出结构化调用参数。
- 工具返回后再总结。

适合目标：

- 想理解 function calling。
- 想往 Agent 方向发展。

### 推荐项目 C：本地 Hermes 聊天 Demo

功能要求：

- 本地运行 Hermes 小模型。
- 支持 system prompt。
- 支持多轮对话。
- 支持切换创作、推理、助手模式。

适合目标：

- 想学习本地模型部署。
- 想理解模型大小、量化和推理速度的关系。

## 学习优先级

如果时间有限，优先学习：

1. Hermes 是什么。
2. Hermes 3 和 Hermes 4 的区别。
3. Prompt 和多轮对话。
4. 工具调用。
5. API 或本地部署。
6. Hermes Agent。
7. 综合 Demo。

## 每天时间安排

如果每天有 1.5 到 2 小时：

```text
30 分钟：看概念
45 分钟：结合模型或工具验证
30 分钟：整理笔记
15 分钟：复盘今天的问题
```

如果每天只有 1 小时：

```text
20 分钟：核心概念
30 分钟：实践验证
10 分钟：写总结
```

## 最终自测清单

一周结束后，检查自己是否能回答：

- Hermes 是什么？
- Hermes Models 和 Hermes Agent 有什么区别？
- Hermes 3 和 Hermes 4 有什么区别？
- Hermes 和 Llama 是什么关系？
- Hermes 适合哪些场景？
- 怎么选择 8B、70B、405B？
- 怎么部署或调用 Hermes？
- Hermes 的工具调用怎么用？
- Hermes Agent 的基本执行流程是什么？
- 如果要用 Hermes 做产品，应该优先验证哪些风险？

## 推荐资料

- [Hermes 3 官方介绍](https://nousresearch.com/hermes3/)
- [Nous Research Releases](https://nousresearch.com/releases/)
- [Nous Portal 模型列表](https://portal.nousresearch.com/info)
- [Hermes 4 70B Hugging Face](https://huggingface.co/NousResearch/Hermes-4-70B)
- [Hermes Agent 官方站](https://hermes-agent.nousresearch.com/)
- [Hermes Agent GitHub Releases](https://github.com/NousResearch/hermes-agent/releases)

## 后续深入方向

完成这一周学习后，可以继续深入：

- Hermes 技术报告。
- Function calling 的 schema 设计。
- Agent 记忆系统。
- 本地模型量化与推理优化。
- vLLM、llama.cpp、Ollama 的部署差异。
- 多模型路由与成本优化。
- Hermes 在个人助手、代码助手、创作助手中的实际表现评测。
