# Week 2 复盘 — 提示词工程

## 本周学了什么

- **System Prompt**：用角色 + 输出结构约束模型行为（代码审查：Bug / 风格 / 安全）
- **Zero-shot**：只描述任务，不给示例；简单任务够用
- **Few-shot**：给 1–3 个输入输出示例，提升格式稳定性
- **CoT**：要求分步推理，适合数学 / 逻辑题，便于调试中间过程

## 跑通 / 实现了什么

命令：`pnpm week2`（源码 `examples/my-learning/src/week2-prompts.ts`）

| 任务 | 文件 | 结果 |
|------|------|------|
| 代码审查 System Prompt | `prompts/code-review.ts` | ✅ 识别 SQL 注入、XSS，按 severity 分级 |
| Few-shot JSON | `prompts/few-shot-json.ts` | ✅ 5/5 合法 JSON（Zero-shot 与 Few-shot 均通过） |
| CoT 数学题 | `prompts/cot-math.ts` | ✅ 分 4 步推导，答案 2.4 小时 |
| 策略对比 | 本文件 | ✅ 见下方 |

---

## 1. 代码审查助手

**System Prompt 要点：**

- 角色：资深审查助手
- 输出结构：`Bug` / `风格` / `安全` 三章
- 每条标注 `critical | warning | info` + 修复建议

**样例代码问题（模型正确指出）：**

- `getUser`：SQL 注入（critical）→ 应用参数化查询
- `renderComment`：XSS（critical）→ 用 `textContent` 或 DOMPurify
- `SELECT *` 可能泄露敏感字段（warning）

---

## 2. Few-shot 情感 JSON

**测试句：** 「代码写得很优雅，但文档几乎没写，上线前有点慌。」

| 策略 | JSON 合法率（5 次） | 典型输出 |
|------|---------------------|----------|
| Zero-shot | **5/5** | `{"sentiment":"neutral","score":0.5}` |
| Few-shot | **5/5** | `{"sentiment":"neutral","score":0.45}` |

**观察：**

- 两者在本模型（DeepSeek）上格式都稳定
- Few-shot 的 score 更贴近示例里的数值风格（0.45 vs 0.5）
- 更复杂 schema 或弱模型上，Few-shot 优势通常更明显

**验收：** 连续 5 次至少 4 次合法 JSON → **通过（5/5）**

---

## 3. CoT 数学题

**题目：** A 管 6h、B 管 4h 注满水池，同时开需几小时？

| 策略 | 输出特点 | 答案 |
|------|----------|------|
| 无 CoT | 直接「2.4小时」，无推理过程 | ✅ 2.4（正确但不可审计） |
| 有 CoT | Step 1–4 算效率、合速度、求时间 | ✅ 2.4 小时（可逐步核对） |

**观察：**

- 简单题两者都能答对
- CoT 的价值在于**可解释、可排错**；复杂多步题差距更大
- 无 CoT 若答错，难以定位哪一步出错

---

## 4. 三种策略对比结论

| 策略 | 适用场景 | 不适用 |
|------|----------|--------|
| **Zero-shot** | 任务简单、格式宽松、快速原型 | 严格 JSON / 复杂格式、弱模型 |
| **Few-shot** | 固定输出格式、分类、抽取 | 示例与真实分布不一致时易误导 |
| **CoT** | 数学、逻辑、多步推理 | 只要最终答案、要低延迟低 token |

**组合用法：**

- 生产接口：`System Prompt` + `Few-shot` + JSON 约束
- 调试 Agent：对关键推理步骤加 `CoT`，日志里保留中间步骤

---

## 卡住的问题与解法

- 无；Direct 数学回答写成「2.4小时」而非「答案：2.4 小时」，解析器未命中，但人工看答案正确 → 生产环境应同时约束**答案格式**

## 下周计划

- Week 3：在 `apps/server` 实现 LCEL 链，Web 联调
