# Week 1 复盘

## 本周学了什么

- LLM API 调用方式：`POST /chat/completions`，消息格式 `system / user / assistant`
- **Token**：计费与上下文工具，计费根据每家情况不定
- **Temperature**：控制大模型输出随机性的参数； 0 更稳定，1.2 表述更展开；同一问题两者语义接近但措辞不同

## 跑通 / 实现了什么

| 任务 | 命令 | 结果 |
|------|------|------|
| curl 首条请求 | `pnpm week1:curl` | ✅ DeepSeek 返回回复 + usage |
| CLI 多轮对话 | `pnpm week1` | ✅ `week1-chat.ts` + 共享 `lib/chat-api` |
| Web → Server → LLM | `pnpm dev` → `/chat` | ✅ Server `POST /api/chat` 已验证 |
| Temperature 实验 | `pnpm week1:experiments` | ✅ 见下方 |
| Token 统计 | 同上 | ✅ prompt/completion/total 已打印 |

### Temperature 实验记录

**问题：** 用一句话描述 JavaScript 的闭包是什么。

| temperature | 输出摘要 | tokens |
|-------------|----------|--------|
| 0 | 「记忆」绑定，访问外部函数变量 | input 14 / output 34 |
| 1.2 | 「绑定关系」，表述更完整 | input 14 / output 40 |

### Token 实验记录

- system + user 共 **22** prompt tokens
- 回复 **23** completion tokens
- **total 45**

## 卡住的问题与解法

- 无；`.env` 使用 DeepSeek 端点时 `OPENAI_BASE_URL=https://api.deepseek.com/v1` 即可

## 下周计划

- Week 2：System Prompt、Few-shot、CoT、JSON 输出实验
