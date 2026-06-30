# my-learning

Week 1 起的练习代码，对应 [AGENT_LEARNING_PLAN.md](../../AGENT_LEARNING_PLAN.md)。

## 命令

```bash
# 根目录 .env 配置 OPENAI_API_KEY 后：

pnpm week1:curl          # curl 发第一条 chat 请求
pnpm week1                 # CLI 多轮对话
pnpm week1:experiments     # Temperature + Token 实验
pnpm week2                 # Week 2 Prompt 实验（审查 / Few-shot / CoT）
pnpm dev                   # Web /chat 页面
```

## 目录

```
src/
├── lib/
│   ├── env.ts           # 读取根目录 .env
│   └── chat-api.ts      # 共用 chat/completions 封装
├── week1-chat.ts        # 多轮 CLI 对话
└── week1-experiments.ts # Week 1 实验脚本
scripts/
└── first-request.sh     # curl 示例
```
