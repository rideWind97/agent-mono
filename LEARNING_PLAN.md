# 🚀 前端侧大模型应用实战 — 学习攻略（从 0 到 1）

> 预计总学习周期：**12–16 周**（每周投入 10–15 小时）
> 目标：系统掌握前端侧大模型应用开发全链路，能独立完成企业级 AI 应用项目

---

## 📋 总览

| 阶段 | 章节 | 周期 | 难度 |
|------|------|------|------|
| **基础篇** | 第一章 ~ 第二章 | 第 1–2 周 | ⭐⭐ |
| **框架篇** | 第三章 ~ 第五章 | 第 3–5 周 | ⭐⭐⭐ |
| **核心篇** | 第六章 ~ 第八章 | 第 6–9 周 | ⭐⭐⭐⭐ |
| **进阶篇** | 第九章 ~ 第十一章 | 第 10–12 周 | ⭐⭐⭐⭐⭐ |
| **实战篇** | 第十二章 + 项目实战 | 第 13–16 周 | ⭐⭐⭐⭐⭐ |

---

## 🏗️ 阶段一：基础篇（第 1–2 周）

### 第一章：大模型应用开发概述

**学习目标：** 理解大模型（LLM）的基本原理、应用场景，以及前端开发者在 AI 时代的角色定位。

**核心知识点：**
- LLM 基本原理（Transformer、GPT 架构概览）
- 主流大模型对比（GPT-4o、Claude、Gemini、DeepSeek、Qwen 等）
- API 调用方式（OpenAI API、Azure OpenAI、国内模型 API）
- Token、Temperature、Top-P 等核心参数理解
- 前端开发者如何切入 AI 应用开发

**学习资料：**
- 📖 [OpenAI 官方文档 — API Reference](https://platform.openai.com/docs/api-reference)
- 📖 [Anthropic Claude 文档](https://docs.anthropic.com/)
- 🎥 [3Blue1Brown — But what is a GPT?](https://www.youtube.com/watch?v=wjZofJX0v4M)（可视化理解 Transformer）
- 📖 [通往 AGI 之路 — 飞书知识库](https://waytoagi.feishu.cn/wiki)（中文 AI 知识大全）
- 📖 [LLM Visualization](https://bbycroft.net/llm)（交互式 LLM 可视化）

**实践任务：**
- [x] 注册 OpenAI / DeepSeek / 通义千问 API，跑通第一个 API 调用
- [x] 用 Node.js / TypeScript 写一个简单的对话脚本
- [x] 对比不同 temperature 值对输出的影响


1. Token：AI 的“燃料”与“计费单位”AI 并不直接阅读汉字或单词，而是将文本拆分成 Token（标记）。直观理解： 在英文中，1 个 Token 大约是 4 个字符或 0.75 个单词；在中文中，一个汉字可能占用 1 到 2 个 Token。输入与输出： 你的 Prompt 是 Input Tokens，AI 生成的回答是 Output Tokens。上下文窗口（Context Window）： 每个模型都有 Token 上限（如 128k）。如果你的对话太长，早期的信息就会被“挤出”内存，导致 AI 出现“失忆”。

2. Temperature（温度）：控制“创造力”与“稳定性”这是最常用的参数，范围通常在 $0$ 到 $2$ 之间。它决定了 AI 预测下一个词时的随机性。低温度 ($0 - 0.3$)： 严谨、确定。 AI 总是选择概率最高的那条路。适合写代码、提取摘要、事实问答。中温度 ($0.7 - 1.0$)： 平衡。 既逻辑通顺又有一点文采。适合日常对话。高温度 ($1.2 - 1.5$)： 疯狂、脑洞大开。 AI 会选择那些概率较低的词，可能产生惊艳的创意，也可能胡言乱语（幻觉）。适合写诗、起名。💡 前端比喻： 就像 CSS 的 transition-timing-function。低温度是 linear（直线执行），高温度是复杂的 cubic-bezier（充满变数）。

3. Top-P (核采样)：控制“选择池”的大小Top-P 是另一种控制多样性的方式。它告诉 AI：“只在累积概率达到 $P$ 的候选词中进行选择”。理解方式： 假设 AI 预测下一个词，备选方案有：[苹果: 0.4, 梨: 0.3, 香蕉: 0.2, 飞机: 0.1]。如果 Top-P = 0.7： AI 只会从“苹果”和“梨”里选（因为 $0.4 + 0.3 = 0.7$），“香蕉”和“飞机”被直接踢出局。如果 Top-P = 0.9： AI 也会考虑“香蕉”。

---

### 第二章：提示词工程（Prompt Engineering）

**学习目标：** 掌握提示词设计的核心技巧，能编写高质量的 System Prompt 和 Few-shot Prompt。

**核心知识点：**
- Prompt 的基本结构（System / User / Assistant 角色）
- Zero-shot、One-shot、Few-shot 提示
- Chain of Thought（CoT）思维链
- 提示词模板设计与复用
- 常见 Prompt 反模式与优化技巧
- 结构化输出（JSON Mode、Schema 约束）

**学习资料：**
- 📖 [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)（官方指南，必读）
- 📖 [Anthropic Prompt Engineering Guide](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
- 📖 [吴恩达 — ChatGPT Prompt Engineering for Developers](https://www.deeplearning.ai/short-courses/chatgpt-prompt-engineering-for-developers/)（免费短课）
- 📖 [Prompt Engineering Guide](https://www.promptingguide.ai/zh)（社区维护，中文版）
- 🔧 [LangSmith Prompt Hub](https://smith.langchain.com/hub)（优质 Prompt 模板库）

**实践任务：**
- [x] 设计一个"代码审查助手"的 System Prompt
- [x] 用 Few-shot 让模型输出固定 JSON 格式
- [x] 实现 CoT 提示，让模型分步解决数学题
- [x] 对比不同 Prompt 策略的输出质量

---

## 🔧 阶段二：框架篇（第 3–5 周）

### 第三章：LangChain.js & LangGraph

**学习目标：** 掌握 LangChain.js 的核心抽象（Chain、Memory、Tool），以及 LangGraph 的图编排能力。

**核心知识点：**
- LangChain.js 核心概念（Model、Prompt Template、Output Parser）
- Chain 链式调用（Sequential Chain、Router Chain）
- LangChain Expression Language (LCEL)
- LangGraph 状态图（StateGraph）
- 节点（Node）、边（Edge）、条件分支
- 消息历史与状态管理

**学习资料：**
- 📖 [LangChain.js 官方文档](https://js.langchain.com/docs/)（必读）
- 📖 [LangGraph.js 官方文档](https://langchain-ai.github.io/langgraphjs/)
- 🎥 [LangChain 官方 YouTube](https://www.youtube.com/@LangChain)
- 📖 [LangChain.js 中文教程](https://js.langchain.com.cn/)
- 🔧 [LangSmith](https://smith.langchain.com/)（调试与追踪平台）

**实践任务：**
- [x] 用 LangChain.js 实现一个带记忆的对话机器人
- [x] 用 LCEL 构建一个 Prompt → LLM → OutputParser 链
- [x] 用 LangGraph 实现一个简单的多步骤工作流

---

### 第四章：Function Call

**学习目标：** 深入理解 Function Calling 机制，能让 AI 调用外部工具完成复杂任务。

**核心知识点：**
- Function Calling 原理（模型如何决定调用哪个函数）
- 函数定义（JSON Schema 描述参数）
- 单次调用 vs 并行调用（Parallel Function Calling）
- 工具调用的消息流（tool_calls → tool 角色回复）
- 错误处理与重试机制
- 安全性考量（防止 Prompt 注入触发危险函数）

**学习资料：**
- 📖 [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)（官方文档，必读）
- 📖 [Anthropic Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview)
- 📖 [Vercel AI SDK — Tool Calling](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- 🎥 [Function Calling 实战教程 — YouTube](https://www.youtube.com/results?search_query=openai+function+calling+tutorial)

**实践任务：**
- [ ] 实现一个天气查询 Agent（AI 调用天气 API）
- [ ] 实现多工具并行调用场景
- [ ] 回顾本仓库的 `web-summarizer`，理解其 Function Call 流程

---

### 第五章：MCP 协议（Model Context Protocol）

**学习目标：** 理解 MCP 协议的设计思想，能开发 MCP Server 和 Client。

**核心知识点：**
- MCP 协议概述（为什么需要标准化的模型上下文协议）
- MCP 架构（Host、Client、Server 三层）
- Transport 层（stdio、SSE、Streamable HTTP）
- Resources、Tools、Prompts 三大原语
- MCP Server 开发（TypeScript SDK）
- MCP Client 集成（在应用中接入 MCP Server）

**学习资料：**
- 📖 [MCP 官方文档](https://modelcontextprotocol.io/)（必读）
- 📖 [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- 📖 [MCP Servers 仓库](https://github.com/modelcontextprotocol/servers)（官方示例集合）
- 📖 [Anthropic MCP 介绍博客](https://www.anthropic.com/news/model-context-protocol)
- 🔧 [MCP Inspector](https://github.com/modelcontextprotocol/inspector)（调试工具）

**实践任务：**
- [ ] 搭建一个简单的 MCP Server（提供文件读写工具）
- [ ] 用 MCP Client 连接并调用 Server 的工具
- [ ] 将 MCP Server 接入 Claude Desktop 或 Cursor 测试

---

## 🧠 阶段三：核心篇（第 6–9 周）

### 第六章：RAG（检索增强生成）

**学习目标：** 掌握 RAG 的完整流程，能构建基于私有知识库的问答系统。

**核心知识点：**
- RAG 原理（Retrieval-Augmented Generation）
- 文档加载与分块（Chunking 策略）
- 向量嵌入（Embedding）与向量数据库
- 相似度搜索（Cosine Similarity、MMR）
- 主流向量数据库对比（Pinecone、Weaviate、Chroma、pgvector）
- RAG 优化技巧（Re-ranking、Hybrid Search、Query Expansion）
- 评估指标（Faithfulness、Relevancy、Context Recall）

**学习资料：**
- 📖 [LangChain RAG 教程](https://js.langchain.com/docs/tutorials/rag/)
- 📖 [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- 🎥 [吴恩达 — Building and Evaluating Advanced RAG](https://www.deeplearning.ai/short-courses/building-evaluating-advanced-rag/)（免费短课）
- 📖 [RAG 论文原文 — Lewis et al.](https://arxiv.org/abs/2005.11401)
- 🔧 [Chroma](https://www.trychroma.com/)（轻量级向量数据库，适合本地开发）
- 🔧 [LlamaIndex](https://www.llamaindex.ai/)（RAG 专用框架）

**实践任务：**
- [ ] 将一组 Markdown 文档向量化并存入 Chroma
- [ ] 实现基于向量搜索的问答系统
- [ ] 对比不同 Chunking 策略对检索质量的影响
- [ ] 加入 Re-ranking 优化检索结果

---

### 第七章：Agent 智能体

**学习目标：** 理解 Agent 的核心架构（感知-推理-行动循环），能构建具备自主决策能力的智能体。

**核心知识点：**
- Agent 定义与分类（ReAct、Plan-and-Execute、Multi-Agent）
- ReAct 模式（Reasoning + Acting）
- Agent 的核心循环（Observe → Think → Act → Observe）
- 工具选择与编排
- 多 Agent 协作（Supervisor、Swarm 模式）
- Agent 的记忆系统（短期 / 长期记忆）
- 安全与可控性（Guard Rails、Human-in-the-loop）

**学习资料：**
- 📖 [LangGraph Agent 教程](https://langchain-ai.github.io/langgraphjs/tutorials/)
- 📖 [OpenAI Agents SDK](https://github.com/openai/openai-agents-js)
- 🎥 [吴恩达 — AI Agents in LangGraph](https://www.deeplearning.ai/short-courses/ai-agents-in-langgraph/)（免费短课）
- 📖 [ReAct 论文](https://arxiv.org/abs/2210.03629)
- 📖 [Lilian Weng — LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/)（经典博客）
- 🔧 [CrewAI](https://www.crewai.com/)（多 Agent 框架）

**实践任务：**
- [ ] 用 LangGraph 实现一个 ReAct Agent
- [ ] 给 Agent 添加多个工具（搜索、计算、代码执行）
- [ ] 实现一个 Supervisor 模式的多 Agent 系统
- [ ] 回顾本仓库的 `web-summarizer` Agent 实现

---

### 第八章：Workflow 工作流

**学习目标：** 掌握 AI 工作流的设计与编排，能构建复杂的多步骤自动化流程。

**核心知识点：**
- 工作流 vs Agent（何时用工作流，何时用 Agent）
- DAG（有向无环图）工作流
- 条件分支与循环
- 人工审批节点（Human-in-the-loop）
- 错误处理与重试
- 工作流持久化与恢复
- 可视化工作流编排

**学习资料：**
- 📖 [LangGraph 工作流文档](https://langchain-ai.github.io/langgraphjs/concepts/)
- 📖 [Anthropic — Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)（经典博客，必读）
- 📖 [Dify 工作流文档](https://docs.dify.ai/)（低代码 AI 工作流平台）
- 🔧 [n8n](https://n8n.io/)（开源工作流自动化）
- 🔧 [Flowise](https://flowiseai.com/)（可视化 LangChain 工作流）

**实践任务：**
- [ ] 设计一个"内容创作工作流"（调研 → 大纲 → 撰写 → 审核）
- [ ] 用 LangGraph 实现带条件分支的工作流
- [ ] 加入 Human-in-the-loop 审批节点

---

## 🔬 阶段四：进阶篇（第 10–12 周）

### 第九章：长期记忆

**学习目标：** 理解 AI 应用中的记忆系统设计，能实现跨会话的长期记忆。

**核心知识点：**
- 短期记忆（对话上下文窗口）
- 长期记忆（跨会话持久化）
- 记忆的存储方式（向量数据库、关系数据库、KV 存储）
- 记忆的检索与更新策略
- 记忆摘要与压缩
- 用户画像与偏好学习
- 隐私与安全考量

**学习资料：**
- 📖 [LangGraph Memory 文档](https://langchain-ai.github.io/langgraphjs/concepts/memory/)
- 📖 [Mem0 — AI Memory Layer](https://github.com/mem0ai/mem0)（专用记忆框架）
- 📖 [MemGPT 论文](https://arxiv.org/abs/2310.08560)（虚拟上下文管理）
- 🎥 [吴恩达 — LangGraph 长期记忆课程](https://www.deeplearning.ai/short-courses/)

**实践任务：**
- [ ] 实现基于向量数据库的长期记忆系统
- [ ] 实现对话摘要压缩（超长对话自动总结）
- [ ] 构建用户偏好记忆（记住用户喜好并个性化回复）

---

### 第十章：模型微调（Fine-tuning）

**学习目标：** 了解模型微调的场景、方法和流程，能完成简单的微调任务。

**核心知识点：**
- 何时需要微调（vs Prompt Engineering vs RAG）
- 微调数据准备（JSONL 格式、数据清洗）
- OpenAI Fine-tuning API
- LoRA / QLoRA 轻量微调
- 微调效果评估
- 成本与收益分析

**学习资料：**
- 📖 [OpenAI Fine-tuning Guide](https://platform.openai.com/docs/guides/fine-tuning)（官方文档）
- 🎥 [吴恩达 — Finetuning Large Language Models](https://www.deeplearning.ai/short-courses/finetuning-large-language-models/)（免费短课）
- 📖 [Hugging Face PEFT 文档](https://huggingface.co/docs/peft)（LoRA 等轻量微调）
- 📖 [Unsloth](https://github.com/unslothai/unsloth)（2x 速度微调工具）
- 📖 [LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory)（中文社区微调框架）

**实践任务：**
- [ ] 准备一份微调数据集（至少 50 条高质量样本）
- [ ] 通过 OpenAI API 完成一次微调
- [ ] 对比微调前后的模型表现

---

### 第十一章：性能优化与成本控制

**学习目标：** 掌握 AI 应用的性能优化和成本控制策略。

**核心知识点：**
- Token 用量优化（Prompt 压缩、上下文裁剪）
- 流式输出（Streaming SSE）
- 缓存策略（语义缓存、精确缓存）
- 模型路由（简单任务用小模型，复杂任务用大模型）
- 并发与限流
- 成本监控与预算告警
- 延迟优化（首 Token 时间、总响应时间）

**学习资料：**
- 📖 [OpenAI 定价页面](https://openai.com/pricing)（了解各模型成本）
- 📖 [Vercel AI SDK — Streaming](https://sdk.vercel.ai/docs/ai-sdk-core/streaming)
- 📖 [GPTCache](https://github.com/zilliztech/GPTCache)（语义缓存框架）
- 📖 [OpenRouter](https://openrouter.ai/)（多模型路由平台）
- 📖 [Helicone](https://www.helicone.ai/)（LLM 可观测性平台）

**实践任务：**
- [ ] 为现有项目添加流式输出（SSE）
- [ ] 实现语义缓存，减少重复请求
- [ ] 设计模型路由策略（根据任务复杂度选择模型）
- [ ] 搭建成本监控面板

---

## 🏆 阶段五：实战篇（第 13–16 周）

### 第十二章：全书总结与项目架构

**学习目标：** 融会贯通前面所有知识，形成完整的 AI 应用架构认知。

**核心知识点：**
- AI 应用架构全景图
- 技术选型决策树（何时用 RAG / Agent / Fine-tuning / Workflow）
- 前后端分离架构设计
- 生产环境部署（Docker、CI/CD）
- 监控与可观测性
- 安全最佳实践

---

### 真实企业级落地项目

**推荐实战项目（按难度递进）：**

#### 项目 1：智能客服系统 ⭐⭐⭐
- RAG + 知识库问答
- 多轮对话管理
- 意图识别与路由
- 人工坐席转接

#### 项目 2：AI 编程助手 ⭐⭐⭐⭐
- 代码补全与生成
- 代码审查 Agent
- 文档自动生成
- MCP 集成 IDE

#### 项目 3：多 Agent 协作平台 ⭐⭐⭐⭐⭐
- Supervisor 调度多个专业 Agent
- 工作流编排与可视化
- 长期记忆与用户画像
- 成本控制与监控

---

### 项目实战案例 — Agent

**结合本仓库 `agent-mono` 的实战路线：**

| 阶段 | 项目 | 涉及章节 |
|------|------|----------|
| ✅ 已完成 | `web-summarizer` — 网页总结官 | 第四章 Function Call、第七章 Agent |
| 🔜 下一步 | RAG 知识库问答 | 第六章 RAG |
| 🔜 进阶 | 多 Agent 工作流 | 第七章 Agent、第八章 Workflow |
| 🔜 高级 | MCP Server 开发 | 第五章 MCP |

---

### 简历中如何体现

**关键词建议：**
```
- 熟悉 LLM 应用开发，掌握 Prompt Engineering、Function Calling、RAG、Agent 等核心技术
- 使用 LangChain.js / LangGraph 构建过多 Agent 协作系统
- 有 MCP 协议 Server/Client 开发经验
- 熟悉向量数据库（Chroma/Pinecone）及 Embedding 检索优化
- 具备 AI 应用性能优化与成本控制经验（流式输出、语义缓存、模型路由）
```

**项目描述模板：**
```
项目名称：XXX 智能助手平台
技术栈：React + TypeScript + Node.js + LangChain.js + LangGraph + OpenAI API
项目描述：
  - 基于 RAG 架构实现企业知识库问答，检索准确率达 XX%
  - 设计并实现多 Agent 协作系统，支持 XX 种工具调用
  - 通过语义缓存和模型路由策略，降低 API 成本 XX%
  - 使用 MCP 协议标准化工具接入，支持 XX 个外部服务集成
```

---

## 🌐 AI 前端方向的落地和实践

### 前端 + AI 的核心场景

| 场景 | 技术要点 | 示例 |
|------|----------|------|
| AI 对话界面 | 流式渲染、Markdown 渲染、代码高亮 | ChatGPT、Claude UI |
| AI 辅助表单 | 自然语言转结构化数据 | 智能填表、语音录入 |
| AI 内容生成 | 实时预览、编辑器集成 | Notion AI、Copilot |
| AI 搜索 | 语义搜索、结果摘要 | Perplexity、New Bing |
| AI 可视化 | Agent 执行过程可视化、工作流编辑器 | Dify、Coze |

### 前端开发者的 AI 技能树

```
前端 AI 工程师
├── 基础能力
│   ├── LLM API 调用（OpenAI / Claude / 国产模型）
│   ├── Prompt Engineering
│   └── 流式输出处理（SSE / WebSocket）
├── 框架能力
│   ├── Vercel AI SDK
│   ├── LangChain.js / LangGraph
│   └── MCP 协议
├── 应用能力
│   ├── RAG 系统搭建
│   ├── Agent 开发
│   └── Workflow 编排
└── 工程能力
    ├── AI 应用性能优化
    ├── 成本控制
    └── 可观测性与监控
```

---

## 📚 通用学习资源汇总

### 必读资源

| 资源 | 类型 | 说明 |
|------|------|------|
| [OpenAI 官方文档](https://platform.openai.com/docs/) | 文档 | API 参考，必须熟读 |
| [Anthropic 文档](https://docs.anthropic.com/) | 文档 | Claude API + 最佳实践 |
| [LangChain.js 文档](https://js.langchain.com/docs/) | 文档 | JS/TS 生态核心框架 |
| [Vercel AI SDK](https://sdk.vercel.ai/) | 文档 | 前端 AI 集成首选 |
| [DeepLearning.AI 短课](https://www.deeplearning.ai/short-courses/) | 视频课 | 吴恩达系列免费课，强烈推荐 |

### 推荐关注

| 资源 | 类型 | 说明 |
|------|------|------|
| [Lilian Weng 博客](https://lilianweng.github.io/) | 博客 | OpenAI 研究员，深度好文 |
| [Simon Willison 博客](https://simonwillison.net/) | 博客 | LLM 应用实践专家 |
| [Latent Space Podcast](https://www.latent.space/) | 播客 | AI 工程领域顶级播客 |
| [AI 前端 — 掘金专栏](https://juejin.cn/column) | 中文 | 搜索"AI 前端"相关专栏 |
| [通往 AGI 之路](https://waytoagi.feishu.cn/wiki) | 中文 | 最全中文 AI 知识库 |

### 实用工具

| 工具 | 用途 |
|------|------|
| [LangSmith](https://smith.langchain.com/) | LLM 调用追踪与调试 |
| [Helicone](https://www.helicone.ai/) | LLM 可观测性 |
| [Prompt Perfect](https://promptperfect.jina.ai/) | Prompt 优化工具 |
| [LM Studio](https://lmstudio.ai/) | 本地运行开源模型 |
| [Ollama](https://ollama.com/) | 本地模型管理 |

---

## 📅 每周学习节奏建议

| 时间 | 活动 | 时长 |
|------|------|------|
| 周一~周三 | 理论学习 + 文档阅读 | 每天 1.5h |
| 周四~周五 | 代码实践 + Demo 开发 | 每天 2h |
| 周六 | 项目实战（在 agent-mono 中实现） | 3–4h |
| 周日 | 复盘总结 + 写学习笔记 | 1–2h |

---

> 💡 **学习建议：** 不要只看不练。每学完一个章节，立刻在 `agent-mono` 仓库中实现一个对应的 Demo 子应用。理论 + 实践结合才能真正掌握。
