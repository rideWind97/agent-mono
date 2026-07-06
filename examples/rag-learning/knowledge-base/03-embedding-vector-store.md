# Embedding 与向量库

Embedding 是把文本转换成数字向量的过程。语义相近的文本，向量距离通常更近。检索时，系统会先把用户问题转换成 query embedding，再和知识库中每个 chunk 的 embedding 计算相似度。

向量库负责保存 chunk、metadata 和 embedding，并提供 similarity search。生产环境常见向量库包括 Chroma、FAISS、Milvus、Pinecone、Weaviate 和 PostgreSQL 的 pgvector。学习阶段也可以用内存数组模拟向量库，只要能保存向量并计算余弦相似度即可。

余弦相似度衡量两个向量方向是否接近，值越高通常代表文本越相关。它不关心向量长度，更关注方向。很多入门 RAG 示例都会使用余弦相似度作为第一版检索算法。

真实 Embedding 模型更懂语义，但会带来 API 成本、网络延迟和密钥配置。本示例使用 Hashing Embedding：把词或短语哈希到固定维度的向量中。它不是生产级语义模型，但足够展示 Embedding、Vector Store 和 Retrieval 的数据流。
