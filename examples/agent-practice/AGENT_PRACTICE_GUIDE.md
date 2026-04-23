# 🤖 Agent 智能体 —— 完整实战学习指南

> 对应学习计划 **第七章：Agent 智能体**
> 技术栈：TypeScript + LangGraph + LangChain + OpenAI API
> 路径：`examples/agent-practice/`

---

## 📋 目录

| Part | 主题 | 核心知识点 | 文件 |
|------|------|-----------|------|
| 1 | [ReAct Agent](#part-1-react-agent) | 推理与行动循环 | `01-react-agent.ts` |
| 2 | [多工具 Agent](#part-2-多工具-agent) | 工具选择与编排 | `02-multi-tools-agent.ts` |
| 3 | [Supervisor 多 Agent](#part-3-supervisor-多-agent-系统) | 多 Agent 协作 | `03-supervisor-multi-agent.ts` |
| 4 | [记忆系统](#part-4-agent-记忆系统) | 短期/长期记忆 | `04-memory-agent.ts` |
| 5 | [安全护栏 + HITL](#part-5-安全护栏--human-in-the-loop) | Guard Rails、人工介入 | `05-guardrails-agent.ts` |

---

## 🚀 快速开始

### 环境准备

```bash
# 1. 进入项目目录
cd examples/agent-practice

# 2. 安装依赖（如果在 workspace 根目录运行过 pnpm install 则已自动安装）
pnpm install

# 3. 配置环境变量（复制 .env.example 并填入你的 API Key）
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY 和 OPENAI_BASE_URL
```

### 运行 Demo

```bash
# 运行全部 Demo
npx tsx src/run-all.ts

# 运行单个 Demo
npx tsx src/01-react-agent.ts        # Part 1: ReAct
npx tsx src/02-multi-tools-agent.ts  # Part 2: 多工具
npx tsx src/03-supervisor-multi-agent.ts  # Part 3: 多 Agent
npx tsx src/04-memory-agent.ts       # Part 4: 记忆
npx tsx src/05-guardrails-agent.ts   # Part 5: 安全

# 选择性运行（run-all 支持传入 Part 编号）
npx tsx src/run-all.ts 1 3   # 只运行 Part 1 和 Part 3
```

---

## 🏗️ 项目架构

```
examples/agent-practice/
├── src/
│   ├── config.ts                    # 统一配置（LLM 工厂、日志工具）
│   ├── tools.ts                     # 5 个共享工具定义
│   ├── 01-react-agent.ts            # Part 1: ReAct Agent
│   ├── 02-multi-tools-agent.ts      # Part 2: 多工具 Agent
│   ├── 03-supervisor-multi-agent.ts # Part 3: Supervisor 多 Agent
│   ├── 04-memory-agent.ts           # Part 4: 记忆系统
│   ├── 05-guardrails-agent.ts       # Part 5: 安全护栏
│   └── run-all.ts                   # 统一运行器
├── package.json
├── tsconfig.json
└── .env.example
```

### 依赖说明

| 包 | 作用 |
|----|------|
| `@langchain/langgraph` | 状态图引擎，实现 Agent 循环和多 Agent 编排 |
| `@langchain/openai` | OpenAI 兼容的 LLM 接口（支持 DeepSeek 等） |
| `@langchain/core` | 核心抽象：Message、Tool、Prompt、OutputParser |
| `zod` | 工具参数的类型定义（自动转为 JSON Schema 传给 LLM） |
| `dotenv` | 环境变量管理 |

---

## Part 1: ReAct Agent

### 核心概念

**ReAct = Reasoning + Acting**

ReAct 是 2022 年由 Yao et al. 提出的 Agent 模式（[论文](https://arxiv.org/abs/2210.03629)），核心思想：

> LLM 不仅输出最终答案，而是交替进行「推理」和「行动」，直到积累了足够信息来回答。

### 执行循环

```
用户提问
    │
    ▼
┌─────────────┐
│  Observe    │ ← 感知用户输入或工具结果
│  (感知)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Think      │ ← LLM 分析当前状态，决定下一步
│  (推理)     │    - 需要更多信息？→ 调用工具
└──────┬──────┘    - 信息足够？→ 输出答案
       │
       ▼
┌─────────────┐
│  Act        │ ← 执行工具调用，获取外部信息
│  (行动)     │
└──────┬──────┘
       │
       ▼
    回到 Observe（工具结果作为新的观察）
    ... 循环直到 LLM 决定直接回答 ...
```

### LangGraph 实现原理

`createReactAgent()` 内部构建了这样的状态图：

```
┌─────────┐   有 tool_calls   ┌──────────┐
│  Agent  │ ───────────────→ │  Tools   │
│  (LLM)  │ ←─────────────── │ (执行器) │
└────┬────┘   工具结果返回     └──────────┘
     │ 无 tool_calls（最终回答）
     ▼
  [END] 输出结果
```

- **Agent 节点**: 调用 LLM，LLM 可能返回文本（最终答案）或 `tool_calls`（工具调用请求）
- **Tools 节点**: 执行 LLM 请求的工具，将结果放入消息历史
- **条件边**: 根据是否有 `tool_calls` 决定循环还是结束

### 关键代码解析

```typescript
// 一行代码创建 ReAct Agent
const agent = createReactAgent({ llm, tools: basicTools });

// 通过 streamEvents 观察完整推理过程
const eventStream = agent.streamEvents(
  { messages: [new HumanMessage(query)] },
  { version: "v2", recursionLimit: 10 }
);

// 事件类型：
// - on_chat_model_start: LLM 开始推理（循环的每一轮）
// - on_tool_start: 工具被调用（Agent 决定需要外部信息）
// - on_tool_end: 工具返回结果（新的观察输入）
// - on_chat_model_stream: LLM 流式输出（最终回答）
```

### 测试用例与预期行为

| 输入 | 预期 Agent 行为 |
|------|----------------|
| "北京今天天气怎么样？" | 调用 `get_weather("北京")` → 根据结果回答 |
| "(156 + 289) * 3 - 100 = ?" | 调用 `calculator("(156+289)*3-100")` → 返回计算结果 |
| "北京和上海哪个更热？" | 调用 `get_weather("北京")` → 调用 `get_weather("上海")` → 对比回答 |
| "什么是 ReAct 模式？" | **不调用工具**，直接用 LLM 知识回答 |

### 学习要点

1. **Agent ≠ 聊天机器人**: Agent 能主动调用工具获取信息，而不仅仅是生成文本
2. **LLM 是决策核心**: LLM 决定「何时用工具」「用哪个工具」「何时直接回答」
3. **recursionLimit 很重要**: 防止 Agent 陷入无限的工具调用循环

---

## Part 2: 多工具 Agent

### 核心概念

当 Agent 拥有多个工具时，**LLM 如何做出正确的工具选择？** 答案在于：

1. **工具的 description**: 这是 LLM 选择工具的唯一依据（相当于 API 文档）
2. **System Prompt**: 指导 Agent 的整体策略（如「不确定时先搜索」）
3. **工具编排**: 一个问题可能需要串行/并行调用多个工具

### 5 个工具设计

| 工具 | 用途 | description 设计要点 |
|------|------|-------------------|
| `get_weather` | 天气查询 | 明确支持的输入格式（中文城市名） |
| `calculator` | 数学计算 | 列举支持的运算符，给出示例 |
| `code_executor` | JS 代码执行 | 说明能力边界（纯函数、不支持 I/O） |
| `search_knowledge` | 知识搜索 | 描述知识库的覆盖领域 |
| `get_current_time` | 时间查询 | 说明参数格式（时区字符串） |

### System Prompt 的关键作用

```typescript
const systemPrompt = `你是一个全能助手，拥有以下工具：
...
使用策略：
1. 遇到不确定的事实性问题，先用 search_knowledge 搜索
2. 遇到数学计算，用 calculator（简单）或 code_executor（复杂逻辑）
3. 需要多个信息时，可以连续调用多个工具
4. 工具返回结果后，整合信息给出完整回答
5. 用中文回答，保持简洁清晰`;
```

**要点**: System Prompt 是 Agent 的「行为准则」。不写策略，Agent 可能乱选工具。

### 工具选择的底层原理

LLM 收到的实际 Prompt 结构（简化）：

```
System: 你是一个全能助手...

Tools available:
- get_weather(city): 查询城市天气...
- calculator(expression): 计算数学表达式...
- code_executor(code): 执行 JavaScript 代码...
- search_knowledge(query): 搜索技术知识库...
- get_current_time(timezone): 获取当前时间...

User: 帮我算一下 (156 + 289) * 3 - 100
```

LLM 在 `tools` 列表中选择最匹配的工具，输出 `tool_calls`:

```json
{ "tool_calls": [{ "name": "calculator", "args": { "expression": "(156+289)*3-100" } }] }
```

### 学习要点

1. **description 是工具选择的唯一依据**: 写得不好 = Agent 选错工具
2. **Zod Schema 做参数校验**: LLM 的参数可能格式不对，Schema 能捕获错误
3. **stateModifier 注入 System Prompt**: 在每次 LLM 调用前自动添加系统指令

---

## Part 3: Supervisor 多 Agent 系统

### 核心概念

当任务足够复杂时，单个 Agent 难以胜任。多 Agent 系统让多个「专家」协作：

**Supervisor 模式（主管调度）:**

```
           ┌──────────────┐
用户任务 → │  Supervisor  │ ← 任务拆分 + 结果汇总
           │  (主管/调度)   │
           └───┬──┬──┬────┘
               │  │  │
           ┌───▼┐┌▼──┐┌▼────┐
           │研究 ││分析││编码  │ ← 各自独立执行
           │Agent││Agent││Agent│
           └───┬┘└┬──┘└┬────┘
               │  │    │
           ┌───▼──▼────▼────┐
           │   Supervisor   │ → 汇总输出
           └────────────────┘
```

### StateGraph 核心概念

| 概念 | 作用 | 代码 |
|------|------|------|
| **Annotation** | 定义状态的 Schema（类型 + 更新规则） | `Annotation.Root({ ... })` |
| **Node** | 处理节点（接收 state，返回 state 更新） | `.addNode("name", fn)` |
| **Edge** | 确定性边（A 执行完必走 B） | `.addEdge("A", "B")` |
| **ConditionalEdge** | 条件边（根据 state 决定走哪条路） | `.addConditionalEdges("A", routerFn)` |
| **START / END** | 内置起点和终点 | `addEdge(START, "first")` |
| **compile** | 编译图，生成可执行实例 | `.compile()` |

### 工作流拓扑

```
START → supervisorPlan → researcher → analyst → coder → supervisorSummarize → END
```

每个节点都是一个异步函数，接收当前状态，返回要更新的字段：

```typescript
async function researcherAgent(state: typeof SupervisorState.State) {
  // 1. 从 state 读取需要的信息
  const task = state.subtasks[0];

  // 2. 调用 LLM 执行任务
  const result = await chain.invoke({ task, userTask: state.userTask });

  // 3. 返回要更新的状态字段（只需要返回变化的部分）
  return {
    results: { ...state.results, researcher: result },
    currentAgent: "analyst",  // 追踪执行进度
  };
}
```

### 与 Swarm 模式的对比

| 维度 | Supervisor | Swarm |
|------|-----------|-------|
| 调度方式 | 集中式（主管分配） | 去中心化（接力传递） |
| 通信方式 | Agent → Supervisor → Agent | Agent → Agent |
| 适合场景 | 可并行的独立子任务 | 有前后依赖的流水线 |
| 容错性 | 某个 Agent 失败，Supervisor 可重试 | 一环断裂，后续停止 |

### 学习要点

1. **StateGraph 是多 Agent 编排的核心**: 通过节点 + 边定义执行拓扑
2. **共享状态是协作的桥梁**: 各 Agent 通过读写 state 进行信息传递
3. **Supervisor 负责「拆」和「合」**: 拆分任务、汇总结果是最重要的两个节点

---

## Part 4: Agent 记忆系统

### 核心概念

| 类型 | 生命周期 | 存储位置 | 类比 |
|------|---------|---------|------|
| **短期记忆** | 当前会话 | state.messages | 工作记忆（正在想的事） |
| **长期记忆** | 跨会话持久化 | 数据库/向量库 | 长期记忆（过去的经验） |

### 短期记忆：MemorySaver

```typescript
const checkpointer = new MemorySaver();  // 内存检查点
const agent = createReactAgent({ llm, tools, checkpointer });

// 用 thread_id 标识会话
await agent.invoke(
  { messages: [new HumanMessage("我叫小明")] },
  { configurable: { thread_id: "session-001" } }
);

// 同一个 thread_id → Agent 记得之前的对话
await agent.invoke(
  { messages: [new HumanMessage("你记得我叫什么吗？")] },
  { configurable: { thread_id: "session-001" } }
  // Agent 会回答「小明」✅
);

// 不同的 thread_id → Agent 不知道
await agent.invoke(
  { messages: [new HumanMessage("你记得我叫什么吗？")] },
  { configurable: { thread_id: "session-999" } }
  // Agent 不知道 ❌
);
```

**关键**: `thread_id` 决定了记忆的隔离边界。同一 ID = 同一会话 = 共享记忆。

### 长期记忆：偏好提取与持久化

```
用户消息 → [LLM 信息提取] → JSON 格式的偏好 → [存入 KV 存储]

下次对话 → [读取用户偏好] → [注入 Prompt] → 个性化回答
```

核心步骤：

1. **提取**: 用 LLM 从对话中抽取结构化信息（姓名、偏好、专业等）
2. **存储**: 保存到持久化存储（本 Demo 用 Map 模拟，生产用数据库）
3. **检索**: 下次对话时读取用户的历史偏好
4. **注入**: 将偏好信息注入到 Prompt 中，实现个性化

### 记忆摘要压缩

当对话历史过长时：

```
原始对话（10 条消息，2000 token）
    ↓ [LLM 摘要]
压缩摘要（50 token）+ 最近 3 条消息（300 token）
    = 350 token（节省 82.5%）
```

**为什么需要压缩？**
- 超长上下文 = 更高成本 + 更慢响应 + 信息丢失（注意力分散）
- 压缩后的摘要保留关键信息，丢弃冗余对话

### 生产环境的记忆存储选择

| 存储方案 | 适合场景 | 举例 |
|---------|---------|------|
| 向量数据库 | 语义检索历史对话 | Chroma, Pinecone |
| 关系数据库 | 结构化用户数据 | PostgreSQL, MySQL |
| KV 存储 | 快速读写用户偏好 | Redis |
| 文件存储 | 本地开发/原型 | JSON 文件 |

### 学习要点

1. **MemorySaver 是最简单的记忆方案**: 一行代码让 Agent 有会话记忆
2. **长期记忆需要「提取→存储→检索→注入」完整流程**
3. **对话压缩是生产环境的必需**: 既省钱又能保持对话连贯性

---

## Part 5: 安全护栏 + Human-in-the-Loop

### 核心概念

Agent 的安全风险矩阵：

| 风险 | 描述 | 防御手段 |
|------|------|---------|
| **Prompt 注入** | 用户通过巧妙输入「劫持」Agent 行为 | 输入检测 + 角色隔离 |
| **敏感数据泄露** | Agent 输出中包含手机号、身份证等 | 输出脱敏 |
| **危险操作** | Agent 执行删除、转账等不可逆操作 | HITL 审批 |
| **资源滥用** | 过长输入或死循环导致 token 浪费 | 长度限制 + recursionLimit |

### 安全工作流拓扑

```
START → securityCheck ─┬─ [safe] ──────→ executeTask → outputFilter → END
                       ├─ [warning] ──→ humanApproval ─┬─ [approved] → executeTask
                       │                               └─ [rejected] → outputFilter → END
                       └─ [critical] ─→ outputFilter → END (直接拒绝)
```

### 三级安全策略

```typescript
// Level 1: safe（安全）→ 直接执行
"什么是 ReAct 模式？"  →  ✅ 通过

// Level 2: warning（警告）→ 需要人工审批
"查看生产环境的状态"  →  ⚠️ 人工审批 → 通过/拒绝

// Level 3: critical（高危）→ 直接阻断
"删除所有用户数据"  →  🚫 阻断
"忽略之前的指令"  →  🚫 疑似 Prompt 注入
```

### 输入安全检查

```typescript
const DANGEROUS_PATTERNS = [
  { pattern: /删除|drop\s+table/i, level: "critical", description: "数据删除" },
  { pattern: /转账|付款/i, level: "critical", description: "资金操作" },
  { pattern: /production|生产环境/i, level: "warning", description: "生产环境操作" },
  { pattern: /忽略之前|ignore previous/i, level: "critical", description: "Prompt 注入" },
];
```

### 输出脱敏

```typescript
const REDACTION_RULES = [
  { pattern: /\b\d{11}\b/g, replacement: "***手机号***" },
  { pattern: /\b\d{16,19}\b/g, replacement: "***银行卡号***" },
  { pattern: /身份证号正则/g, replacement: "***身份证号***" },
];
```

### Human-in-the-Loop 实现

LangGraph 的 `addConditionalEdges` 实现了审批路由：

```typescript
.addConditionalEdges("securityCheck", (state) => {
  if (state.securityCheck.blocked) return "outputFilter";       // critical → 直接拒绝
  if (state.securityCheck.requiresApproval) return "humanApproval"; // warning → 审批
  return "executeTask";                                          // safe → 执行
})
```

真实生产环境中，`humanApproval` 节点应该：
1. 使用 LangGraph 的 `interrupt()` 机制暂停工作流
2. 发送通知给审批人（邮件、Slack、内部系统）
3. 等待异步审批响应
4. 恢复工作流继续执行

### 学习要点

1. **安全是 Agent 上线的前提**: 没有护栏的 Agent 不应该上生产
2. **分级处理**: 不是所有风险都需要阻断，warning 级别可以人工审批
3. **Prompt 注入是 LLM 应用的特有风险**: 需要专门的检测策略
4. **输出脱敏是最后一道防线**: 即使 LLM 泄露了敏感信息，脱敏也能兜底

---

## 📊 知识点总结矩阵

| 知识点 | Part 1 | Part 2 | Part 3 | Part 4 | Part 5 |
|--------|:------:|:------:|:------:|:------:|:------:|
| ReAct 循环 | ✅ | ✅ | | | |
| 工具定义 (tool + Zod) | ✅ | ✅ | | | |
| streamEvents | ✅ | ✅ | | | |
| System Prompt 策略 | | ✅ | | | |
| StateGraph | | | ✅ | | ✅ |
| Annotation 状态定义 | | | ✅ | | ✅ |
| 条件边 (addConditionalEdges) | | | ✅ | | ✅ |
| createReactAgent | ✅ | ✅ | | ✅ | |
| MemorySaver 检查点 | | | | ✅ | |
| 长期记忆 | | | | ✅ | |
| 记忆摘要压缩 | | | | ✅ | |
| 输入安全检查 | | | | | ✅ |
| 输出脱敏 | | | | | ✅ |
| Human-in-the-Loop | | | | | ✅ |

---

## 🔗 对应学习计划任务

- [x] 用 LangGraph 实现一个 ReAct Agent → **Part 1**
- [x] 给 Agent 添加多个工具（搜索、计算、代码执行） → **Part 2**
- [x] 实现一个 Supervisor 模式的多 Agent 系统 → **Part 3**
- [x] Agent 记忆系统（短期 / 长期记忆） → **Part 4**
- [x] 安全与可控性（Guard Rails、Human-in-the-loop） → **Part 5**

---

## 📚 推荐阅读

| 资源 | 说明 |
|------|------|
| [ReAct 论文](https://arxiv.org/abs/2210.03629) | ReAct 模式的原始论文 |
| [LangGraph.js 文档](https://langchain-ai.github.io/langgraphjs/) | LangGraph 官方文档 |
| [Lilian Weng — LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/) | 经典 Agent 综述博客 |
| [Anthropic — Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) | Agent 设计最佳实践 |
| [吴恩达 — AI Agents in LangGraph](https://www.deeplearning.ai/short-courses/ai-agents-in-langgraph/) | 免费视频短课 |

---

## 💡 进阶方向

学完本项目后，建议继续探索：

1. **接入真实工具**: 替换 mock 数据，接入真实的天气 API、搜索引擎（Tavily）、代码沙箱
2. **构建前端界面**: 用 Vue 搭建 Agent 对话 UI，实时展示工具调用过程（参考 `apps/web-vue`）
3. **生产级记忆**: 用 PostgreSQL + pgvector 实现长期记忆的语义检索
4. **多 Agent 动态路由**: Supervisor 根据任务类型动态选择需要哪些专家 Agent
5. **LangGraph Studio**: 使用可视化工具调试和观察 Agent 的执行流程

---

> 📝 本文档由 Agent 实战项目自动生成，对应仓库路径 `examples/agent-practice/`
