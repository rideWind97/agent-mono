# ⚙️ Workflow 工作流 —— 完整实战学习指南

> 对应学习计划 **第八章：Workflow 工作流**
> 技术栈：TypeScript + LangGraph + LangChain + OpenAI API
> 路径：`examples/workflow-practice/`

---

## 📋 目录

| Part | 主题 | 核心知识点 | 文件 |
|------|------|-----------|------|
| 1 | [内容创作工作流](#part-1-内容创作工作流dag) | DAG 有向无环图 | `01-content-creation-workflow.ts` |
| 2 | [条件分支与循环](#part-2-条件分支与循环) | addConditionalEdges、循环控制 | `02-conditional-branch-loop.ts` |
| 3 | [Human-in-the-Loop](#part-3-human-in-the-loop-审批) | interrupt / resume、人工审批 | `03-human-in-the-loop.ts` |
| 4 | [错误处理与重试](#part-4-错误处理与重试) | 指数退避、模型降级 | `04-error-handling-retry.ts` |
| 5 | [持久化与恢复](#part-5-工作流持久化与恢复) | MemorySaver、多 Thread、状态回溯 | `05-persistence-recovery.ts` |

---

## 🚀 快速开始

```bash
# 1. 进入项目目录
cd examples/workflow-practice

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY 和 OPENAI_BASE_URL

# 3. 运行
npx tsx src/run-all.ts           # 运行全部
npx tsx src/01-content-creation-workflow.ts  # 单独运行 Part 1
npx tsx src/run-all.ts 2 4       # 运行 Part 2 和 Part 4
```

---

## 🏗️ 项目架构

```
examples/workflow-practice/
├── src/
│   ├── config.ts                          # 统一配置（LLM 工厂、日志）
│   ├── 01-content-creation-workflow.ts     # Part 1: DAG 工作流
│   ├── 02-conditional-branch-loop.ts      # Part 2: 条件分支 + 循环
│   ├── 03-human-in-the-loop.ts            # Part 3: HITL 审批
│   ├── 04-error-handling-retry.ts         # Part 4: 重试 + 降级
│   ├── 05-persistence-recovery.ts         # Part 5: 持久化
│   └── run-all.ts                         # 统一运行器
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 前置知识：工作流 vs Agent

在开始之前，理解这两个概念的区别至关重要：

| 维度 | 工作流（Workflow） | Agent |
|------|-------------------|-------|
| 路由方式 | 开发者预定义（静态/条件路由） | LLM 自主决定（动态路由） |
| 可预测性 | 高（执行路径可预期） | 低（LLM 可能走不同路径） |
| 适合场景 | 步骤明确的业务流程 | 开放性问题，需要灵活决策 |
| 调试难度 | 低（流程图一目了然） | 高（需要追踪 LLM 决策） |
| 用哪个？ | **能画成流程图 → 工作流** | **不能画成流程图 → Agent** |

> Anthropic 在《Building Effective Agents》中的建议：
> "如果你的任务可以用流程图画出来，那就用工作流而不是 Agent"

---

## Part 1: 内容创作工作流（DAG）

### 核心概念

**DAG = Directed Acyclic Graph（有向无环图）**

```
START → research → outline → draft → review → END
         调研       大纲      撰写     审核
```

- **有向**：数据沿固定方向流动（调研结果 → 大纲 → 初稿）
- **无环**：不会回到之前的节点（没有循环）
- **每个节点**：接收共享状态 → 执行逻辑 → 返回状态更新

### StateGraph 三要素

```typescript
// 1. 定义状态（所有节点共享的数据结构）
const ContentState = Annotation.Root({
  topic: Annotation<string>(),
  research: Annotation<string>(),
  outline: Annotation<string>(),
  draft: Annotation<string>(),
  review: Annotation<string>(),
});

// 2. 添加节点（每个节点是一个 async 函数）
new StateGraph(ContentState)
  .addNode("research", researchNode)
  .addNode("outline", outlineNode)
  .addNode("draft", draftNode)
  .addNode("review", reviewNode)

// 3. 连接边（定义执行顺序）
  .addEdge(START, "research")
  .addEdge("research", "outline")
  .addEdge("outline", "draft")
  .addEdge("draft", "review")
  .addEdge("review", END)
  .compile();
```

### 节点函数模式

每个节点遵循相同的模式：读取所需状态 → 执行逻辑 → 返回更新

```typescript
async function outlineNode(state: typeof ContentState.State) {
  // 1. 读取前置节点的输出
  const { topic, research } = state;

  // 2. 执行本节点逻辑（调用 LLM）
  const outline = await chain.invoke({ topic, research });

  // 3. 只返回要更新的字段（框架自动合并到 state）
  return { outline };
}
```

### 学习要点

1. **Annotation 是状态的 Schema**：定义了有哪些字段、什么类型
2. **节点只返回变化的字段**：不需要返回完整 state，框架自动合并
3. **addEdge 定义确定性边**：A 完成后必然执行 B

---

## Part 2: 条件分支与循环

### 核心概念

现实工作流不是纯线性的，需要根据中间结果做决策：

```
START → write → score ─┬─ ≥7 分 ────────→ publish → END
                        ├─ <7 分且未超限 → revise → write（循环）
                        └─ <7 分但超限 ──→ maxRevisions → END
```

### addConditionalEdges —— 条件路由

```typescript
.addConditionalEdges("score", (state) => {
  // 路由函数：接收当前 state，返回下一个节点的名称
  if (state.score >= 7) return "publish";        // 高分 → 发布
  if (state.revisionCount >= state.maxRevisions)
    return "maxRevisions";                        // 超限 → 终止
  return "prepareRevision";                       // 低分 → 修改
})
```

### 循环的实现

用条件边指向之前的节点，形成循环：

```typescript
.addEdge("prepareRevision", "write")  // 修改后 → 回到撰写节点
```

**防死循环**：用 `revisionCount` 计数器 + `maxRevisions` 上限

### 与 Agent 的对比

| 场景 | 工作流写法 | Agent 写法 |
|------|-----------|-----------|
| 评分后决定路由 | `addConditionalEdges(路由函数)` | LLM 自己判断，不一定准 |
| 循环修改 | 明确的 revisionCount 控制 | LLM 可能无限循环 |
| 可预测性 | ✅ 路由逻辑完全确定 | ❌ 取决于 LLM 输出 |

### 学习要点

1. **条件边用函数做路由**：函数读 state，返回节点名
2. **循环 = 条件边指向之前的节点**
3. **必须有循环终止条件**：计数器 / 质量阈值 / 超时

---

## Part 3: Human-in-the-Loop 审批

### 核心概念

高风险操作（发布、付款、删除）需要人工确认：

```
generate → [interrupt] → 人工审批 ─┬─ 通过 → publish
                                    ├─ 修改 → revise → generate（循环）
                                    └─ 拒绝 → reject
```

### LangGraph 的 interrupt 机制

```typescript
// 在节点中调用 interrupt() → 工作流暂停
async function humanApprovalNode(state) {
  const approvalRequest = interrupt({
    message: "请审批以下内容",
    draft: state.draft,
  });
  // 当 Command({ resume }) 恢复时，approvalRequest = resume 传入的值
  const decision = approvalRequest.decision;
  return { approvalDecision: decision };
}
```

### 恢复工作流

```typescript
// 审批人操作后，恢复工作流执行
await workflow.invoke(
  new Command({ resume: { decision: "approved", feedback: "" } }),
  { configurable: { thread_id: "xxx" } }
);
```

### 三要素

| 组件 | 作用 |
|------|------|
| `interrupt()` | 暂停工作流，冻结当前状态 |
| `MemorySaver` | 保存暂停时的完整状态（检查点） |
| `Command({ resume })` | 携带审批结果恢复执行 |

### 真实系统中的 HITL

```
工作流暂停
  ↓
通知审批人（邮件 / Slack / 企业微信）
  ↓
审批人在 UI 上操作（通过 / 拒绝 / 修改意见）
  ↓
前端调 API → Command({ resume }) → 工作流恢复
```

### 学习要点

1. **interrupt() 不是 sleep**：它冻结整个工作流状态
2. **必须搭配 checkpointer**：没有检查点，暂停后无法恢复
3. **thread_id 标识工作流实例**：同一个 thread_id 才能恢复同一个流程

---

## Part 4: 错误处理与重试

### 核心概念

生产环境的三大错误处理策略：

```
          ┌─ 可重试错误 → 指数退避重试（200ms → 400ms → 800ms）
错误发生 ─┤
          ├─ 重试耗尽 → 降级（换模型 / 用缓存 / 默认值）
          │
          └─ 不可重试错误 → 直接失败 + 记录日志
```

### 指数退避算法

```typescript
async function withRetry<T>(fn: () => Promise<T>, options) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      // 200ms → 400ms → 800ms → 1600ms ...
      await sleep(delay);
    }
  }
}
```

**为什么不用固定间隔？**
- 固定间隔：所有客户端同时重试 → 服务端再次过载（雷群效应）
- 指数退避：重试间隔逐渐拉长 → 给服务端恢复时间

### 模型降级

```typescript
const modelCandidates = [
  { model: "gpt-4o", label: "主模型" },
  { model: "gpt-4o-mini", label: "备用模型" },  // 更快、更便宜
];

for (const candidate of modelCandidates) {
  try {
    return await callLLM(candidate.model);
  } catch {
    continue;  // 当前模型失败，尝试下一个
  }
}
```

### 可重试 vs 不可重试

| 可重试（暂时性故障） | 不可重试（持久性故障） |
|-------------------|-------------------|
| 超时（Timeout） | 参数错误（400） |
| 网络中断（ECONNRESET） | 认证失败（401） |
| 限流（429） | 资源不存在（404） |
| 服务不可用（503） | 余额不足 |

### 学习要点

1. **指数退避是标准做法**：不是所有重试都用固定间隔
2. **降级要有明确标记**：结果来自缓存/默认值时必须告知下游
3. **错误日志必须记录**：重试次数、错误原因、最终结果

---

## Part 5: 工作流持久化与恢复

### 核心概念

| 场景 | 为什么需要持久化 |
|------|----------------|
| HITL 审批 | 审批人可能隔天才回复 |
| 长流程 | 运行几小时的 pipeline |
| 进程重启 | 部署更新后要从断点恢复 |
| 审计回溯 | 查看历史执行的每一步状态 |

### MemorySaver 用法

```typescript
const checkpointer = new MemorySaver();
const workflow = graph.compile({ checkpointer });

// thread_id 标识一个工作流实例
await workflow.invoke(input, {
  configurable: { thread_id: "my-thread-001" }
});

// 读取保存的状态
const state = await workflow.getState({
  configurable: { thread_id: "my-thread-001" }
});

// 遍历历史检查点
for await (const cp of workflow.getStateHistory(config)) {
  console.log(cp.values.phase, cp.values.steps.length);
}
```

### 多 Thread 并行

不同 `thread_id` = 互不干扰的工作流实例：

```typescript
await Promise.all([
  workflow.invoke(input1, { configurable: { thread_id: "thread-A" } }),
  workflow.invoke(input2, { configurable: { thread_id: "thread-B" } }),
  workflow.invoke(input3, { configurable: { thread_id: "thread-C" } }),
]);
```

### 生产环境存储方案

| 方案 | 适合场景 | 持久化 |
|------|---------|--------|
| MemorySaver | 开发调试 | ❌ 进程结束丢失 |
| SqliteSaver | 单机部署 | ✅ 文件持久化 |
| PostgresSaver | 生产环境 | ✅ 高可用 + 并发 |

### 学习要点

1. **checkpointer 是持久化的唯一入口**：compile 时传入
2. **thread_id 是隔离单元**：不同 thread 的状态互不影响
3. **getStateHistory 支持审计**：可以回溯工作流的每一步

---

## 📊 知识点总结矩阵

| 知识点 | Part 1 | Part 2 | Part 3 | Part 4 | Part 5 |
|--------|:------:|:------:|:------:|:------:|:------:|
| StateGraph + Annotation | ✅ | ✅ | ✅ | ✅ | ✅ |
| addEdge（线性边） | ✅ | ✅ | ✅ | ✅ | ✅ |
| addConditionalEdges | | ✅ | ✅ | | |
| 循环（边指向之前的节点） | | ✅ | ✅ | | |
| interrupt / resume | | | ✅ | | |
| MemorySaver 检查点 | | | ✅ | | ✅ |
| Command({ resume }) | | | ✅ | | |
| 指数退避重试 | | | | ✅ | |
| 模型降级 | | | | ✅ | |
| thread_id 隔离 | | | ✅ | | ✅ |
| getStateHistory | | | | | ✅ |

---

## 🔗 对应学习计划任务

- [x] 设计一个"内容创作工作流"（调研→大纲→撰写→审核）→ **Part 1**
- [x] 用 LangGraph 实现带条件分支的工作流 → **Part 2**
- [x] 加入 Human-in-the-loop 审批节点 → **Part 3**
- [x] 错误处理与重试 → **Part 4**
- [x] 工作流持久化与恢复 → **Part 5**

---

## 📚 推荐阅读

| 资源 | 说明 |
|------|------|
| [Anthropic — Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) | Agent vs 工作流的最佳实践，必读 |
| [LangGraph 概念文档](https://langchain-ai.github.io/langgraphjs/concepts/) | StateGraph、检查点、Human-in-the-loop |
| [Dify 工作流文档](https://docs.dify.ai/) | 可视化 AI 工作流平台，理解产品形态 |
| [n8n](https://n8n.io/) | 开源工作流自动化，参考设计模式 |

---

## 💡 进阶方向

1. **可视化编排器**：用 Vue 构建拖拽式的工作流编辑 UI（参考 Dify / n8n）
2. **并行节点**：LangGraph 支持并行节点执行（如调研和竞品分析同时进行）
3. **子工作流**：把复杂节点拆为嵌套的子 StateGraph
4. **事件驱动**：结合 Webhook 实现外部触发（如 GitHub Push → 自动代码审核工作流）
5. **PostgresSaver**：替换 MemorySaver，实现真正的生产级持久化

---

> 📝 本文档对应仓库路径 `examples/workflow-practice/`
