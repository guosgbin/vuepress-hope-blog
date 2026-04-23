---
title: 11-llamaindex 的 chromadb SDK
date: 2026-04-22 16:09:50
tags: 
  - RAG
categories:
  - RAG
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年04月22日16:09:52 |

## ChromaDB 核心概念

### 向量数据库基本原理

向量数据库是一种专门用于存储和检索高维向量数据的数据库系统。在AI和机器学习领域，文本、图像、音频等非结构化数据通常通过Embedding模型转换为高维向量表示。这些向量包含了数据的语义信息，相似的对象在向量空间中彼此接近。

ChromaDB 是一个开源的向量数据库（Apache 2.0 许可证），专为存储和检索 Embedding 向量而设计。其核心工作流程：

1. **存储**：将 Embedding 模型生成的向量与原始文本、元数据一同持久化
2. **索引**：对向量构建 HNSW 索引，支持高效的近似最近邻搜索
3. **检索**：给定查询向量，在向量空间中寻找与查询向量最相似的存储向量。相似度通过距离度量（如余弦相似度、欧氏距离或点积）计算，返回向量空间中最相似的 Top-K 结果

### ChromaDB 架构

ChromaDB 具体架构：官方地址 https://docs.trychroma.com/reference/architecture/distributed

### 核心功能及适用场景

ChromaDB的核心功能包括：

- **向量存储与管理** ：支持存储海量向量数据，通过Collection概念组织相关向量集合。每个Collection可包含多个向量，每个向量可关联元数据用于过滤检索。

- **多种相似度度量** ：支持余弦相似度（cosine）、欧氏距离（l2）和点积（ip）三种距离计算方法。

- **元数据过滤** ：支持基于元数据的预过滤和后过滤，支持SQLite查询和FTS5全文搜索。

- **持久化支持** ：支持数据持久化存储，采用本地文件系统和WAL机制确保数据安全。

ChromaDB适用于以下典型场景：

- **RAG应用** ：为LLM提供知识库检索能力
- **语义搜索** ：实现基于语义的文本搜索
- **推荐系统** ：基于向量相似度的推荐
- **Agent记忆** ：存储Agent的对话历史和上下文

## LLaMAIndex ChromaDB SDK 解析

`llama-index-vector-stores-chroma` 是 LLaMAIndex 官方提供的 ChromaDB 向量存储集成包。它实现了 `VectorStore` 协议，使 ChromaDB 可以无缝接入 LLaMAIndex 的索引体系。

ChromaVectorStore ：核心向量存储实现类，封装了与ChromaDB的交互逻辑。

### 初始化

```python
from llama_index.vector_stores.chroma import ChromaVectorStore
import chromadb

# 方式一：使用持久化客户端
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection("my_collection")
vector_store = ChromaVectorStore(chroma_collection=collection)

# 方式二：使用内存客户端（测试用）
chroma_client = chromadb.EphemeralClient()
collection = chroma_client.create_collection("test_collection")
vector_store = ChromaVectorStore(chroma_collection=collection)

# 方式三：使用HTTP客户端（远程服务器）
chroma_client = chromadb.HttpClient(host="localhost", port=8000)
collection = chroma_client.get_or_create_collection("remote_collection")
vector_store = ChromaVectorStore(chroma_collection=collection)
```

### 存储向量

```python
# 构造几个模拟的 Document 对象
documents = [
    Document(
        text="Python 是一门广泛使用的高级编程语言，支持面向对象和函数式编程范式。",
        metadata={"category": "编程语言", "topic": "Python"},
    ),
    Document(
        text="机器学习是人工智能的一个分支，它使用算法和统计模型让计算机从数据中学习规律。",
        metadata={"category": "人工智能", "topic": "机器学习"},
    ),
    Document(
        text="向量数据库专门用于存储和检索高维向量数据，常用于语义搜索和推荐系统。",
        metadata={"category": "数据库", "topic": "向量检索"},
    ),
]

embed_model = OllamaEmbedding(model_name="qwen3-embedding:0.6b", embed_batch_size=50)
splitter = SentenceSplitter(chunk_size=50, chunk_overlap=10)
nodes = splitter.get_nodes_from_documents(documents=documents, show_progress=True)

# 调用模型接口生成向量，此处使用批量接口
embeddings = embed_model.get_text_embedding_batch(
    [node.get_content(metadata_mode=MetadataMode.EMBED) for node in nodes],
    show_progress=True,
)

# 把生成的向量绑定到 Node 对象
for node, embedding in zip(nodes, embeddings):
    node.embedding = embedding

# 使用持久化客户端
chroma_client = chromadb.PersistentClient(path="./chroma_storage/chroma_db")
collection = chroma_client.get_or_create_collection("my_collection")
vector_store = ChromaVectorStore(chroma_collection=collection)

ids = vector_store.add(nodes)

print(f'{len(ids)} nodes ingested into vector store')
pprint.pprint(vector_store.__dict__)
```

*输出*

```
4 nodes ingested into vector store
{'collection_kwargs': {},
 'collection_name': None,
 'flat_metadata': True,
 'headers': None,
 'host': None,
 'is_embedding_query': True,
 'persist_dir': None,
 'port': None,
 'ssl': False,
 'stores_text': True}
```

注意上面的 stores_text 字段，

- **`stores_text = True`**（当前情况）： 表示向量数据库（ChromaDB）的 Collection 中，不仅存储了 Embedding 向量和 ID，还存储了原始的文本内容（`documents` 字段）。当 LlamaIndex 执行相似度检索时，向量数据库会直接返回匹配的文本。LlamaIndex 拿到结果后直接就能构建出包含完整内容的 `Node` 对象。这通常效率更高，架构更简单。
- **`stores_text = False`**： 表示该向量存储只负责存向量和 ID，不存文本（例如某些精简模式的 FAISS 索引，只维护内存中的向量矩阵）。

### 向量检索

上面的存储向量小节已经添加了数据到 chromadb 中，现在查询一下：

```python
chroma_client = chromadb.PersistentClient(path="./chroma_storage/chroma_db")
collection = chroma_client.get_or_create_collection("my_collection")
vector_store = ChromaVectorStore(chroma_collection=collection)

# 待查询的问题向量化
embed_model = OllamaEmbedding(model_name="qwen3-embedding:0.6b", embed_batch_size=50)
query_embedding_data = embed_model.get_text_embedding("Python是什么")

result = vector_store.query(query=VectorStoreQuery(query_embedding=query_embedding_data, similarity_top_k=1))
print(result)
```

*输出*

```
VectorStoreQueryResult(nodes=[TextNode(id_='f03aa372-2f46-4890-b76f-22b688f9fe36', embedding=None, metadata={'category': '编程语言', 'topic': 'Python'}, excluded_embed_metadata_keys=[], excluded_llm_metadata_keys=[], relationships={<NodeRelationship.SOURCE: '1'>: RelatedNodeInfo(node_id='08c41156-7aaf-4ce4-a7a4-60ce93218ca3', node_type='4', metadata={'category': '编程语言', 'topic': 'Python'}, hash='c81199489980de90e0a0bf2414156f656f24ec59dd41facd1b04c5e1c8a944d4')}, metadata_template='{key}: {value}', metadata_separator='\n', text='Python 是一门广泛使用的高级编程语言，支持面向对象和函数式编程范式。', mimetype='text/plain', start_char_idx=0, end_char_idx=37, text_template='{metadata_str}\n\n{content}')], similarities=[0.5260453570582689], ids=['f03aa372-2f46-4890-b76f-22b688f9fe36'])
```

### 数据持久化

ChromaVectorStore 的持久化机制由底层 Chroma 自动管理，无需手动实现：

- **C/S 模式**：数据由 Server 端负责持久化
- **嵌入模式**：通过 `persist_dir` 参数指定本地持久化目录



使用 `PersistentClient` 时，数据以以下结构存储在磁盘上：

```
persist_dir/
├── chroma.sqlite3              # SQLite 数据库，存储 SysDB 元数据和文档/元数据段
└── {collection-uuid}/          # 每个 Collection 一个目录
    ├── header.bin              # HNSW 索引头/元数据
    ├── data_level0.bin         # HNSW 图基础层（Level 0）及全部向量数据
    ├── link_lists.bin          # HNSW 图上层连接结构
    └── length.bin              # 向量长度元数据
```

- **自动持久化**：现代 ChromaDB 的 PersistentClient 在每次写入后自动将数据刷新到磁盘，无需手动调用 `persist()`
- **SQLite 事务**：元数据和文档数据的写入通过 SQLite 事务保证原子性

---

Sources:

- [ChromaVectorStore 源码](https://github.com/run-llama/llama_index/blob/main/llama-index-integrations/vector_stores/llama-index-vector-stores-chroma/llama_index/vector_stores/chroma/base.py)
- [Chroma 集成文档](https://developers.llamaindex.ai/python/framework/integrations/vector_stores/chromaindexdemo/)
- [ChromaVectorStore API 参考](https://developers.llamaindex.ai/python/framework-api-reference/storage/vector_store/chroma/)
- [ChromaDB 架构文档](https://docs.trychroma.com/docs/overview/architecture)
