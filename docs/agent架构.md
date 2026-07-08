# Agent 的 7 种主流架构

## 1. 单 Agent 架构

结构：

```text
用户 → LLM → 工具 → 输出
```

这是最基础的 Agent，一个大模型负责理解需求、调用工具、生成结果。

**特点：**

简单、容易实现，适合单一任务和快速验证。

**适合场景：**

```text
文案生成
代码解释
简单问答
单文件分析
简单工具调用
```

**缺点：**

复杂任务容易失控，因为所有决策都靠一个 Agent 完成。

比如：

```text
帮我分析这个 Vue 组件有什么问题
帮我根据接口返回生成 TS 类型
帮我把这段代码改成 Composition API
```

这种用单 Agent 就够了。

---

## 2. ReAct 架构

ReAct = Reasoning + Acting，也就是：

```text
思考 → 行动 → 观察 → 再思考 → 再行动
```

结构：

```text
Thought → Action → Observation → Thought → Action → Final
```

**特点：**

它不是一次性回答，而是边推理、边调用工具、边根据结果调整下一步。

**适合场景：**

```text
问题排查
复杂搜索
代码调试
构建失败分析
线上报错定位
PDF 多步骤解析
```

举个例子：

```text
任务：项目启动失败

Agent：
1. 先看 package.json
2. 再看报错日志
3. 再检查 node 版本
4. 再检查依赖版本
5. 最后给修复方案
```

**优点：**

灵活，适合不确定性强的问题。

**缺点：**

容易多走无用步骤，成本高，需要限制最大循环次数。

---

## 3. Plan & Execute 架构

结构：

```text
Planner 负责规划
Executor 负责执行
```

也就是先规划，再执行。

```text
用户任务
→ Planner 拆解任务
→ Executor 按步骤执行
→ 汇总结果
```

**特点：**

比 ReAct 更有条理。ReAct 是边走边想，Plan & Execute 是先想清楚再执行。

**适合场景：**

```text
复杂代码重构
生成完整项目结构
多文件修改
技术方案设计
自动化测试生成
```

比如：

```text
任务：优化 Vue Flow 画布性能

Planner：
1. 检查节点数量
2. 检查渲染策略
3. 检查事件监听
4. 检查内存泄漏
5. 输出优化方案

Executor：
按每一步执行分析和修改
```

**优点：**

结构清晰，适合工程类复杂任务。

**缺点：**

如果前面的计划错了，后面的执行也可能跟着错，所以中途需要校验和调整。

---

## 4. 多 Agent 架构

结构：

```text
Manager Agent
  ├── Frontend Agent
  ├── Backend Agent
  ├── QA Agent
  ├── DevOps Agent
  └── Security Agent
```

多个 Agent 分工协作，每个 Agent 负责自己的专业领域。

**特点：**

像一个虚拟团队。

**适合场景：**

```text
复杂项目开发
需求拆解
系统设计
多人角色协作
AI 员工系统
```

比如你前面问的“AI 员工”，就属于这个方向：

```text
产品经理 Agent：拆需求
前端 Agent：写页面
后端 Agent：设计接口
测试 Agent：写测试用例
安全 Agent：做安全检查
DevOps Agent：设计部署方案
```

**优点：**

专业分工清晰，适合复杂任务。

**缺点：**

调度复杂，多个 Agent 之间容易重复、冲突、废话变多，成本也高。

---

## 5. Router + Skill 架构，推荐重点掌握

这张图里明确标了 **推荐**，我也认为这是你当前最应该重点理解的架构。

结构：

```text
用户
→ Intent Router 意图路由
→ 选择合适 Skill
→ 执行任务
→ 输出
```

比如：

```text
用户：帮我优化这个 Vue 组件性能

Router 判断：
这是前端性能优化任务

调用：
Frontend Performance Skill
```

如果用户说：

```text
帮我设计这个接口的数据表
```

Router 判断：

```text
这是后端架构任务
调用 Backend Architect Skill
```

**特点：**

它不是所有 Agent 都上，而是先识别任务意图，然后精准调用对应 Skill。

**适合场景：**

```text
AI coding
Cursor / Claude Code / Codex
企业内部开发助手
AI 员工技能库
项目规范助手
```

这也是当前 AI coding 场景里非常实用的架构。

你之前问的 `agency-agents`、`agent-skills`、各种前端/后端 skill，本质上都可以理解为：

```text
Router + Skill 架构
```

**优点：**

精准、成本低、可维护性好。

**缺点：**

需要设计好 Skill 分类和路由规则，否则会选错技能。

对你这种前端项目，可以这样设计：

```text
Intent Router
  ├── Vue3 Skill
  ├── Nuxt3 Skill
  ├── Vue Flow Skill
  ├── SCSS Skill
  ├── Performance Skill
  ├── Code Review Skill
  ├── Testing Skill
  └── Git / CI Skill
```

比如用户输入：

```text
画布很卡，帮我分析
```

Router 应该调用：

```text
Vue Flow Skill
Performance Skill
Memory Leak Skill
```

这比单纯让一个 Agent 瞎分析要稳定很多。

---

## 6. Blackboard 架构，黑板系统

结构：

```text
Agent A
Agent B → Blackboard 共享状态 → Agent C
Agent D
```

Blackboard 就是一个共享的信息中心，所有 Agent 都往里面写信息，也从里面读取信息。

**特点：**

多个 Agent 不直接互相乱聊，而是通过一个共享状态协作。

**适合场景：**

```text
复杂协作
多角色分析
共享上下文
长期任务
需要沉淀中间结果的任务
```

比如做一个需求评审：

```text
产品 Agent 写需求理解
前端 Agent 写前端风险
后端 Agent 写接口风险
测试 Agent 写测试点
安全 Agent 写安全风险

所有内容都写到 Blackboard
最后由 Summary Agent 汇总
```

**优点：**

信息共享清晰，不容易丢上下文。

**缺点：**

需要设计共享状态结构，否则黑板会变成“垃圾桶”，越写越乱。

适合企业级复杂协作，但初学阶段不建议先做这个。

---

## 7. Graph / Workflow 架构，企业级主流

结构：

```text
Start
→ Node A
→ 条件判断
   ├── Node B
   └── Node C
→ Node D
→ End
```

也就是图结构工作流。

**特点：**

节点、条件、分支、并行、重试、人工审核都可以编排。

**适合场景：**

```text
企业级 Agent
复杂业务流程
稳定生产系统
可观测任务流
多步骤自动化
```

比如 PDF 识别输出 JSON：

```text
Start
→ 上传 PDF
→ 判断是否扫描件
   ├── 是：OCR
   └── 否：文本解析
→ 表格提取
→ 字段抽取
→ JSON Schema 校验
→ 低置信度人工审核
→ 入库
→ End
```

**优点：**

最稳定、最适合生产环境。

**缺点：**

开发成本更高，需要流程引擎、状态管理、日志、重试、监控。

企业里真正能落地的 Agent，大多数最后都会走向：

```text
Graph / Workflow + Router + Skill
```

---

# 这 7 种架构怎么选？

可以按复杂度这样理解：

```text
单 Agent
→ ReAct
→ Plan & Execute
→ 多 Agent
→ Router + Skill
→ Blackboard
→ Graph / Workflow
```

但真实项目选型不是越复杂越好。

## 简单任务

用：

```text
单 Agent
```

例如：

```text
解释代码
生成函数
写一段 SQL
写一段 CSS
```

---

## 不确定问题排查

用：

```text
ReAct
```

例如：

```text
项目启动失败
接口请求失败
页面卡顿
构建报错
```

---

## 复杂任务拆解

用：

```text
Plan & Execute
```

例如：

```text
重构一个模块
设计项目目录
生成完整测试方案
分析一整个代码仓库
```

---

## AI 员工系统

用：

```text
多 Agent
Router + Skill
Supervisor
```

例如：

```text
前端员工
后端员工
测试员工
运维员工
安全员工
```

但不要一上来所有 Agent 都跑，最好是：

```text
Router 先判断任务
再调用对应员工
```

---

## 企业级稳定流程

用：

```text
Graph / Workflow
```

例如：

```text
PDF 识别
合同审核
工单流转
客服自动处理
代码发布检查
```

---

# 我重新给你一个更实用的总结

如果你是为了学习 Agent，我建议你这么理解：

| 架构               | 核心能力        | 特点    | 适合场景           |
| ---------------- | ----------- | ----- | -------------- |
| 单 Agent          | 一个模型完成任务    | 简单直接  | 简单问答、单步任务      |
| ReAct            | 边思考边行动      | 灵活探索  | 调试、排查、搜索       |
| Plan & Execute   | 先规划再执行      | 结构清晰  | 复杂工程任务         |
| 多 Agent          | 多角色协作       | 分工明确  | AI 员工、虚拟团队     |
| Router + Skill   | 意图路由 + 技能调用 | 精准高效  | AI Coding、企业助手 |
| Blackboard       | 共享状态协作      | 上下文统一 | 多 Agent 复杂协作   |
| Graph / Workflow | 图结构流程编排     | 稳定可控  | 企业级生产系统        |

---

# 对你最重要的是哪几个？

结合你现在的方向：**前端开发、Nuxt3、Vue3、vue-flow、AI coding、AI 员工、PDF 识别 JSON**，你重点学这 4 个就够了：

```text
1. Router + Skill
2. Workflow / Graph
3. ReAct
4. Plan & Execute
```

原因是：

```text
Router + Skill：适合做 AI 员工和代码助手
Workflow / Graph：适合做可上线的业务 Agent
ReAct：适合解决不确定问题
Plan & Execute：适合复杂工程任务拆解
```

如果你要做一个真正能用的“AI 员工系统”，我建议架构是：

```text
用户输入
→ Intent Router 判断任务类型
→ 选择合适 Skill / Agent
→ 如果是简单任务：直接执行
→ 如果是复杂任务：Plan & Execute
→ 如果需要工具探索：局部 ReAct
→ 如果是业务流程：Graph / Workflow 编排
→ 最后 Reflection 做质量检查
→ 输出结果
```

一句话总结：

```text
Router + Skill 是当前 AI Coding 场景最实用的架构；
Graph / Workflow 是企业级 Agent 最稳定的架构；
ReAct 适合探索和排错；
Plan & Execute 适合复杂任务拆解；
多 Agent 适合做 AI 员工，但必须配合 Router 或 Supervisor，否则很容易失控。
```

组合 1：RAG + Tool Agent

适合知识库问答、项目文档问答。

用户问题
→ 检索知识库
→ 必要时调用工具
→ 基于结果回答
组合 2：Workflow + LLM

适合稳定业务系统。

固定业务流程
→ 每一步用 LLM 做分类/抽取/总结
→ 校验
→ 输出

这是最容易上线的。

组合 3：Workflow + ReAct

适合复杂但要可控的任务。

主流程固定
局部步骤让 Agent 自主判断

比如 PDF 抽取：

文件解析流程固定
但字段识别阶段可以让 ReAct Agent 多轮判断
组合 4：Supervisor + Multi-Agent

适合“AI 员工”系统。

主管 Agent 接需求
→ 分配给前端/后端/测试/运维
→ 汇总结果