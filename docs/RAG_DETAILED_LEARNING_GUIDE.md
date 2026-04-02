# RAG 详细学习指南

本文对齐 `LEARNING_PLAN.md:217-223` 的学习目标与知识点。

## 1）RAG 原理（Retrieval-Augmented Generation，检索增强生成）

RAG 的核心思想是：**先检索（Retrieve），再生成（Generate）**。

基本流程：

1. 将用户问题转为更适合检索的查询表达。
2. 从知识库中检索相关文本片段（chunks）。
3. 将检索到的上下文注入提示词（prompt）。
4. 基于证据上下文生成最终答案。

为什么重要：

- 降低模型幻觉（hallucination）。
- 把私有数据 / 最新数据引入模型回答。
- 让答案可解释（可以展示引用证据）。

## 2）文档加载与分块（Chunking）策略

分块是 RAG 质量的第一个关键杠杆。

常见策略：

- **定长分块（Fixed-size chunking）**：实现简单、速度快，但容易截断语义。
- **句子/段落分块（Sentence/paragraph chunking）**：语义完整性更好。
- **重叠分块（Overlapping chunking）**：降低边界信息丢失。

核心权衡：

- chunk 太小：上下文不完整，回答容易缺信息。
- chunk 太大：召回精度下降，token 成本增加。

实战建议：

- 初始可用 `300-800 tokens`、`10%-20% overlap`。
- 参数调优要基于评估指标，不靠主观感觉。

## 3）向量嵌入（Embedding）与向量数据库

### Embedding 是什么

Embedding 会把文本映射到稠密向量空间。语义越接近，向量距离通常越近。

### 向量数据库作用

- 存储向量与元数据（metadata）。
- 支持近邻检索（nearest-neighbor search）。
- 支持过滤、索引持久化等能力。

## 4）相似度搜索（Cosine / MMR）

### Cosine Similarity（余弦相似度）

- 通过向量夹角衡量相似性。
- 是向量检索最常见的基础指标。

### MMR（Max Marginal Relevance，最大边际相关性）

MMR 同时优化两件事：

- 与查询的**相关性（Relevance）**
- 结果之间的**多样性（Diversity）**

作用：避免 top-k 全是“高相似重复片段”。

## 5）主流向量数据库对比（Pinecone / Weaviate / Chroma / pgvector）

- **Pinecone**：托管 SaaS，运维轻，适合快速生产落地。
- **Weaviate**：Schema 与混合检索能力较强。
- **Chroma**：轻量、便于本地原型验证。
- **pgvector**：复用 PostgreSQL 生态，事务集成友好。

选型清单：

- 规模预期（文档量 / QPS）
- 延迟 SLA
- 云上或本地部署约束
- 预算与团队运维能力

## 6）RAG 优化技巧

### Re-ranking（重排）

第一阶段检索主要追求召回（recall），重排阶段追求精度（precision）。

典型做法：

- 阶段 1：先召回 20-50 个候选（快）
- 阶段 2：对候选重排，选更高质量上下文（准）

### Hybrid Search（混合检索）

融合稠密检索（dense）与稀疏检索（sparse/关键词）：

- dense 擅长语义匹配
- sparse 擅长实体词 / 精确词匹配

### Query Expansion（查询扩展）

通过同义词、别名、子问题重写扩展原始查询，提高召回概率。

示例：

- 原始问题：`RAG 评估怎么做`
- 扩展查询：
  - `RAG faithfulness metrics`
  - `context recall measurement`
  - `retrieval relevance evaluation`

## 7）评估指标

### Faithfulness（忠实度）

答案是否忠实于检索证据，是否“有据可依”。

### Relevancy（相关性）

答案是否真正回答了用户问题意图。

### Context Recall（上下文召回）

检索阶段是否覆盖了回答问题所需的关键证据。

## 8）本仓库 demo 覆盖内容

参见：`examples/rag-learning`

当前 demo 包含：

- 两种分块策略（固定思路 + 句子分块）
- 可离线复现的确定性 embedding（hash-based）
- 内存向量库（in-memory vector store）
- 余弦检索 + MMR
- 混合检索（关键词 + 向量）
- 简单重排
- 查询扩展
- Faithfulness / Relevancy / Context Recall 三项评估

该 demo 故意保持本地、可复现，便于你逐步调试每个环节。

## 9）建议学习路径

1. 先只跑 baseline 检索。
2. 打开 MMR，比较结果多样性变化。
3. 打开 Hybrid Search，比较实体词召回变化。
4. 打开 Query Expansion，比较召回提升。
5. 打开 Re-ranking，比较最终答案质量。
6. 每步都记录评估指标，形成优化闭环。

## 10）迁移到生产环境的建议顺序

理解本 demo 后，建议按以下顺序迁移：

1. 将本地 embedding 替换为模型 embedding API。
2. 将内存索引替换为向量数据库。
3. 增加 metadata 过滤与引用展示（citation）。
4. 增加请求级可观测性（retrieve/rerank 耗时）。
5. 构建评测数据集并加入 CI 回归评估。
