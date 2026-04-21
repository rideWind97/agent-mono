# 智能客服系统实现文档（Go + Vue）

## 1. 文档目标

本文档详细说明本次在 monorepo 中新增的智能客服系统实现，覆盖：

- 业务目标与范围
- 系统架构设计
- 后端（Go）实现细节
- 前端（Vue）实现细节
- API 与通信协议
- DeepSeek 兼容说明
- 运行与验证步骤
- 当前限制与后续优化建议

对应新增子应用：

- `apps/cs-server`：基于 Go 的客服服务端
- `apps/cs-web`：基于 Vue 3 的客服前端

---

## 2. 需求映射（对齐学习计划）

基于 `LEARNING_PLAN.md` 中“项目 1：智能客服系统”要求，本次落地实现如下：

### 2.1 RAG + 知识库问答

已实现：

- 知识库存储（内存）
- 文档分段与索引
- 查询检索（向量检索 + 关键词降级）
- 将检索到的上下文注入 LLM Prompt

### 2.2 多轮对话管理

已实现：

- 会话创建、查询、列表
- 消息历史记录与状态维护
- 会话状态机：`ai` / `human` / `closed`

### 2.3 意图识别与路由

已实现：

- 意图识别服务（LLM + 规则兜底）
- 预置意图类型（产品咨询、订单、技术支持、投诉、转人工等）
- 根据意图自动路由到 AI 回答或人工转接

### 2.4 人工坐席转接

已实现：

- 客户端请求转人工
- 服务端状态切换为 `human`
- WebSocket 通道用于客户与坐席实时消息互通
- 坐席侧可“转回 AI”

---

## 3. 代码结构总览

### 3.1 服务端：`apps/cs-server`

```text
apps/cs-server/
├── cmd/server/main.go                # 程序入口、路由注册、依赖装配
├── internal/
│   ├── config/config.go              # 环境变量配置加载
│   ├── handler/                      # HTTP / WS 接口层
│   │   ├── chat.go
│   │   ├── intent.go
│   │   ├── knowledge.go
│   │   └── ws.go
│   ├── middleware/logger.go          # 请求日志中间件
│   ├── model/types.go                # 核心数据结构
│   ├── service/
│   │   ├── chat/session.go           # 会话管理
│   │   ├── intent/recognizer.go      # 意图识别
│   │   ├── knowledge/store.go        # 知识库与检索
│   │   └── rag/rag.go                # RAG 组装与回答
│   └── ws/hub.go                     # WebSocket Hub
├── pkg/llm/client.go                 # LLM 客户端封装
├── knowledge_base/seed.json          # 启动时预置知识库文档
├── .env.example
├── go.mod / go.sum
├── Makefile
└── package.json                      # 通过 pnpm 暴露 dev/build 命令
```

### 3.2 前端：`apps/cs-web`

```text
apps/cs-web/
├── src/
│   ├── api/index.ts                  # 后端 API 调用封装
│   ├── types/index.ts                # 前端类型定义
│   ├── composables/
│   │   ├── useChat.ts                # 聊天核心状态与 SSE 处理
│   │   └── useWebSocket.ts           # WebSocket 连接封装
│   ├── components/
│   │   ├── CustomerChat.vue          # 客户聊天页
│   │   ├── AgentWorkbench.vue        # 人工坐席工作台
│   │   ├── ChatBubble.vue
│   │   ├── ChatInput.vue
│   │   └── StreamingBubble.vue
│   ├── styles/                       # 设计 token / mixin / 全局样式
│   ├── router.ts
│   ├── App.vue
│   └── main.ts
├── public/vite.svg
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
└── package.json
```

---

## 4. 服务端实现说明（Go）

## 4.1 技术选型

- Web 框架：Gin
- CORS：gin-contrib/cors
- WebSocket：gorilla/websocket
- LLM SDK：sashabaranov/go-openai
- 配置加载：godotenv + os.Getenv

## 4.2 启动流程

`cmd/server/main.go` 中核心启动逻辑：

1. 加载 `.env`
2. 读取配置（端口、模型、baseURL、apiKey）
3. 创建 LLM 客户端
4. 初始化知识库并加载 `seed.json`
5. 初始化会话管理、意图识别、RAG 服务
6. 启动 WS Hub
7. 注册 HTTP 与 WS 路由
8. 启动 Gin Server 并监听信号优雅退出

## 4.3 领域模型（`internal/model/types.go`）

关键结构：

- `Session`：会话全局状态
- `Message`：对话消息
- `Intent` / `IntentDefinition`：意图识别结果与配置
- `KnowledgeDoc` / `KnowledgeChunk`：知识库文档与分片
- `ChatRequest` / `ChatResponse`：聊天请求与响应
- `WSMessage`：WebSocket 传输协议

## 4.4 会话管理（多轮对话）

`internal/service/chat/session.go` 提供：

- `Create()`：新建会话
- `GetOrCreate(id)`：按 sessionId 查找或自动创建
- `AddMessage()`：追加消息并刷新更新时间
- `SetStatus()`：切换 AI/人工状态
- `SetIntent()`：记录当前意图
- `SetAgent()`：绑定当前坐席
- `List()` / `ListByStatus()`：会话查询

当前使用内存存储，重启后会话丢失。

## 4.5 意图识别与路由

`internal/service/intent/recognizer.go`：

- 先调用 LLM 做结构化识别（返回 JSON）
- 失败时走规则兜底（关键词匹配）
- 内置 `NeedsHuman()` 判断是否需转人工

默认意图集合：

- `product_inquiry`
- `order_query`
- `tech_support`
- `complaint`（需人工）
- `human_agent`（需人工）
- `greeting`
- `other`

## 4.6 知识库与 RAG

### 4.6.1 知识库存储

`internal/service/knowledge/store.go`：

- `AddDocument()`：文档入库并切分段落
- `Search()`：按查询检索 topK 分片
- `ListDocs()` / `GetDoc()` / `DeleteDoc()`：管理接口

### 4.6.2 检索策略

优先：向量相似度（cosine similarity）

降级：关键词覆盖率（`keywordScore`）

### 4.6.3 RAG 生成

`internal/service/rag/rag.go`：

- 检索相关分片
- 构建系统 Prompt（包含“参考文档1/2/3”）
- 注入最近历史消息
- 调用 LLM 同步或流式输出

## 4.7 人工坐席转接（WebSocket）

`internal/ws/hub.go` 负责：

- 客户端注册/注销
- 按 `sessionId` 分组广播
- 客户与坐席消息双向转发
- `agent_join`、`agent_message` 等事件

转接路径：

1. 用户触发转人工（主动按钮或意图命中）
2. 会话状态改为 `human`
3. 发送 `transfer_request`
4. 坐席页面接入并回复
5. 可执行“转回 AI”

## 4.8 API 路由清单

基础路由：

- `GET /health`

聊天与会话：

- `POST /api/cs/chat`
- `POST /api/cs/chat/stream`（SSE）
- `POST /api/cs/sessions`
- `GET /api/cs/sessions`
- `GET /api/cs/sessions/:id`
- `POST /api/cs/sessions/:id/transfer/human`
- `POST /api/cs/sessions/:id/transfer/ai`

知识库：

- `GET /api/cs/knowledge`
- `GET /api/cs/knowledge/:id`
- `POST /api/cs/knowledge`
- `DELETE /api/cs/knowledge/:id`
- `GET /api/cs/knowledge/search?q=...`

意图：

- `GET /api/cs/intents`
- `POST /api/cs/intents/recognize`

WebSocket：

- `GET /ws/customer?sessionId=...`
- `GET /ws/agent?sessionId=...`

---

## 5. 前端实现说明（Vue）

## 5.1 技术选型

- Vue 3 + `<script setup lang="ts">`
- Vue Router
- Vite
- Sass
- markdown-it（AI 消息 Markdown 渲染）

## 5.2 页面与路由

- `/`：客户聊天页面 `CustomerChat.vue`
- `/agent`：人工坐席页面 `AgentWorkbench.vue`

顶层导航在 `App.vue` 中切换两端角色视图。

## 5.3 客户端聊天流

`useChat.ts` 实现：

- 会话初始化
- 发送用户消息
- 调用 `POST /api/cs/chat/stream`
- 解析 SSE 事件：
  - `session`
  - `intent`
  - `delta`
  - `message`
  - `error`
  - `done`
- 维护 UI 状态（loading、流式内容、当前意图、会话状态）

`CustomerChat.vue` 实现：

- 消息列表与欢迎态
- 快捷问题按钮
- 手动转人工按钮
- 人工模式下的 WebSocket 接收

## 5.4 坐席工作台流

`AgentWorkbench.vue` 实现：

- 轮询获取 `human` 状态会话列表
- 选中会话后连接 `/ws/agent`
- 发送 `agent_join` 与 `agent_message`
- 接收客户消息并实时更新列表
- 支持“转回 AI”

## 5.5 样式系统

沿用统一设计 token 思路：

- `styles/variables.scss`：颜色、间距、字体、阴影等 token
- `styles/mixins.scss`：按钮、输入框、布局等 mixin
- `styles/global.scss`：reset + 全局样式

---

## 6. DeepSeek 兼容说明（重点）

由于你当前使用的是 DeepSeek 兼容 OpenAI API，需要注意：

1. `OPENAI_BASE_URL` 必须是完整 API 前缀：
   - `https://api.deepseek.com/v1`
2. `OPENAI_MODEL` 应设置 DeepSeek 聊天模型：
   - `deepseek-chat`
3. DeepSeek 不提供 OpenAI Embedding 接口：
   - 本系统已实现自动降级到关键词检索，不阻塞核心问答流程
4. Go 服务默认不会自动读取 `.env`：
   - 已在启动时接入 `godotenv.Load()`

示例配置见：`apps/cs-server/.env.example`

---

## 7. 运行方式

## 7.1 安装依赖

在仓库根目录：

```bash
pnpm install
```

## 7.2 启动后端

```bash
pnpm dev:cs-server
```

或：

```bash
cd apps/cs-server
make dev
```

默认端口：`3400`

## 7.3 启动前端

```bash
pnpm dev:csweb
```

默认端口：`5300`

## 7.4 访问入口

- 客户端：`http://localhost:5300/`
- 坐席端：`http://localhost:5300/agent`

---

## 8. 已完成验证

本次实现后已执行：

- `go mod tidy`
- `go build ./...`（在 `apps/cs-server`）
- `npx vue-tsc --noEmit`（在 `apps/cs-web`）

结果：均通过。

---

## 9. 当前实现边界与风险

## 9.1 存储层

- 当前会话、知识库均为内存存储
- 服务重启后数据会丢失

建议：

- 会话迁移到 Redis/PostgreSQL
- 知识库迁移到向量数据库（Qdrant/Milvus/pgvector）

## 9.2 检索能力

- DeepSeek 下主要依赖关键词检索（向量降级）
- 语义召回质量受限

建议：

- 接入支持 Embedding 的服务（OpenAI embedding / 本地 embedding 模型）
- 离线构建向量索引

## 9.3 安全与权限

- WebSocket 鉴权尚未接入
- 坐席身份验证尚未实现
- CORS 当前为全开放

建议：

- 增加 JWT 鉴权与角色权限
- 收敛 CORS 白名单
- 对管理接口增加鉴权

## 9.4 可靠性与观测

- 缺少重试、限流、熔断策略
- 缺少 metrics / tracing

建议：

- 接入 Prometheus + Grafana
- 增加请求级日志追踪 ID

---

## 10. 下一步可迭代计划

建议按优先级推进：

1. 数据持久化（会话/知识库）
2. 坐席认证与权限控制
3. 工单化（转人工后自动生成工单）
4. 质检与满意度反馈
5. 客服运营面板（会话量、转人工率、平均响应时长）

---

## 11. 快速自测脚本（可选）

### 11.1 意图识别

```bash
curl -X POST http://localhost:3400/api/cs/intents/recognize \
  -H "Content-Type: application/json" \
  -d '{"message":"我要投诉，帮我转人工"}'
```

### 11.2 创建会话

```bash
curl -X POST http://localhost:3400/api/cs/sessions
```

### 11.3 知识库搜索

```bash
curl "http://localhost:3400/api/cs/knowledge/search?q=退款规则"
```

---

## 12. 结论

本次实现已经完成一个可运行的“智能客服系统 MVP”：

- 支持知识库问答（RAG）
- 支持多轮会话管理
- 支持意图识别与自动路由
- 支持人工转接与坐席实时回复
- 已兼容 DeepSeek（含 Embedding 降级策略）

该版本适合用于学习、功能演示和后续工程化扩展。
