---
title: RAG-14-llamaindex 检索器
date: 2026-04-27 11:29:45
tags: 
  - RAG
  - AI&LLM
categories:
  - RAG
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年04月27日11:29:53 |

## 定义

检索器是 RAG 负责数据召回的组件，它接受用户查询，从海量 Node 中，用某种相关性算法，检索出最相关的相关知识上下文，并以 Node 列表形式返回。

Retriever 决定了**LLM 能看到什么**，而不是：LLM 怎么思考

所以：

- 检索不好 → LLM 再强也没用（garbage in, garbage out）
- 检索好 → 小模型也能表现很好

## 检索器相关流程

![image-20260427150214215](./14-llamaindex%20%E6%A3%80%E7%B4%A2%E5%99%A8_img/image-20260427150214215.png)

所有检索器的统一入口。定义了整个检索流程的骨架。伪代码如下

```python
# 公共入口（用户调用的就是这个）
def retrieve(self, str_or_query_bundle: QueryType) -> List[NodeWithScore]:
    query_bundle = QueryBundle(str_or_query_bundle)  # 统一为 QueryBundle
    nodes = self._retrieve(query_bundle)              # 子类实现的核心逻辑
    nodes = self._handle_recursive_retrieval(query_bundle, nodes)  # 递归展开 IndexNode
    return nodes
```

**统一返回类型**：`List[NodeWithScore]`——每个节点带一个可选的相似度分数。

**模板方法模式**：

- `retrieve()` 是公共入口，处理回调、事件、递归等公共逻辑
- `_retrieve()` 是抽象方法，由子类实现具体检索逻辑

## 简单案例

通过索引组件构造检索器最直接的方法是 as_retriever。构造检索器有一些常见的配置选项， 比如参数 retriever_mode 表示检索模式、参数 similarity_top_k 表示检索语义最相似的数量等。这些参数通常会在调用 as_retriever 方法时输入。

```python
llm = Ollama(model='qwen:0.5b')
embed_model = OllamaEmbedding(model_name="qwen3-embedding:0.6b", embed_batch_size=50)
Settings.embed_model = embed_model
Settings.llm = llm

# 构造几个模拟的 Document 对象
documents = [
    Document(text="机器学习是人工智能的一个分支，它使用算法和统计模型让计算机从数据中学习规律。",
             metadata={"category": "人工智能", "topic": "机器学习"}, ),
    Document(text="向量数据库专门用于存储和检索高维向量数据，常用于语义搜索和推荐系统。",
             metadata={"category": "数据库", "topic": "向量检索"}, ),
]

# 文本分割
splitter = SentenceSplitter(chunk_size=50, chunk_overlap=10)
nodes = splitter.get_nodes_from_documents(documents=documents, show_progress=True)

index = VectorStoreIndex(nodes=nodes, show_progress=True)

# 测试
retriever = index.as_retriever()
nodes_with_score = retriever.retrieve("什么是向量检索")
print(nodes_with_score)
```

*输出*

```
[NodeWithScore(node=TextNode(id_='aab062eb-445e-426b-968b-33672eb728ea', embedding=None, metadata={'category': '数据库', 'topic': '向量检索'}, excluded_embed_metadata_keys=[], excluded_llm_metadata_keys=[], relationships={<NodeRelationship.SOURCE: '1'>: RelatedNodeInfo(node_id='17a106e2-8021-4f6d-8cb8-7985f3173546', node_type='4', metadata={'category': '数据库', 'topic': '向量检索'}, hash='db299dc664497a64d9800dff8c5b3eb00c639b5501a8e4d3893a0bffd1236260')}, metadata_template='{key}: {value}', metadata_separator='\n', text='向量数据库专门用于存储和检索高维向量数据，常用于语义搜索和推荐系统。', mimetype='text/plain', start_char_idx=0, end_char_idx=34, text_template='{metadata_str}\n\n{content}'), score=0.7430682873986796), NodeWithScore(node=TextNode(id_='6a74ee0d-3d80-4f6b-b7ff-42a4233cf794', embedding=None, metadata={'category': '人工智能', 'topic': '机器学习'}, excluded_embed_metadata_keys=[], excluded_llm_metadata_keys=[], relationships={<NodeRelationship.SOURCE: '1'>: RelatedNodeInfo(node_id='deb8e503-de23-4f65-a67c-8c74447f4c74', node_type='4', metadata={'category': '人工智能', 'topic': '机器学习'}, hash='bcec76d61bc01720b6196e7ff54a5909d6fc988f1a68a988c120bd1ba18600b3'), <NodeRelationship.PREVIOUS: '2'>: RelatedNodeInfo(node_id='911b6f8f-7148-4faa-b223-dc2e97ed7c0c', node_type='1', metadata={'category': '人工智能', 'topic': '机器学习'}, hash='6c830d0eb7ede3908ee225232983acbb309582c12d8e2dc9b47a989a821db2b0')}, metadata_template='{key}: {value}', metadata_separator='\n', text='和统计模型让计算机从数据中学习规律。', mimetype='text/plain', start_char_idx=20, end_char_idx=38, text_template='{metadata_str}\n\n{content}'), score=0.4364257321386992)]
```

## 理解检索模式和检索参数

### 指定检索模式

使用 as_retriever 方法构造检索器，那么可以设置 retriever_mode 参数来指定检索模式，如：

```python
retriever = TreeIndex.as_retriever(retriever_mode=TreeRetrieverMode.ROOT)
```

### 不同类型的索引支持的检索模式

#### 向量存储索引

RAG 应用中最常见的索引类型——向量存储索引只支持一种检索模式， 就是根据向量的语义相似度来进行检索 （as_retriever 方法中指定的 retriever_mode参数将被忽略） ，对应的检索器类型为 VectorIndexRetriever。常见参数如下：

| 参数名                  | 用途                                     |
| ----------------------- | ---------------------------------------- |
| similarity_top_k        | 检索出相关性最高的 Node 数量             |
| filters                 | 元数据过滤器，在向量检索时先做元数据过滤 |
| vector_store_query_mode | 向量存储查询模式，需要向量库支持         |

需要注意的是，这种检索器的部分特性依赖于底层的向量库，需要根据使用的向量库来参考。

#### 文档摘要索引

```python
class DocumentSummaryRetrieverMode(str, Enum):
    EMBEDDING = "embedding"
    LLM = "llm"
```

**2 种检索模式**，通过 `retriever_mode` 切换：

| 模式                | 说明                                                         | 核心参数                                                     | 依赖             |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ---------------- |
| `embedding`（默认） | 借助嵌入模型与向量相似度判断摘要内容与输入问题的相关性，获得最相关的摘要 Node，然后输出对应的基础 Node，对应的检索器类型为 DocumentSummaryIndexEmbeddingRetriever。 | `similarity_top_k` 选择相关的摘要 Node 数量，注意不是返回 Node | ✅ embedding 模型 |
| `llm`               | 使用大模型判断摘要内容与输入问题的相关性，获得最相关的摘要Node，然后输出对应的基础Node，对应的检索器类型为DocumentSummaryIndexLLMRetriever。 | `choice_select_prompt` — 使用大模型判断摘要相关性的 Prompt 模板 | ✅ LLM            |

**工作流程**：

```
embedding 模式：文档摘要 → embedding → 向量相似度 → top-k 文档
llm 模式：查询 + 所有摘要 → LLM 逐一评分 → 选出相关文档
```

#### 对象索引

对象索引是一种特殊的索引类型，**本质上是将普通对象序列化后，依赖其他索引类型**来实现存储和检索功能。由于它是基于其他索引构建的，因此**对象索引的检索类型完全取决于它所使用的底层索引类型**。

如下方代码所示，当对象索引指定使用 `VectorStoreIndex` 作为底层索引时，其检索模式即为**向量检索模式**：

```python
object_index = ObjectIndex.from_objects(
    objs,
    index_cls=VectorStoreIndex,
    storage_context=storage_context
)
```

#### 知识图谱索引

以下是这五种属性图（Property Graph）检索器的原理及依赖关系说明：

| 检索器名称                  | 原理说明                                                     | 核心依赖                   |
| :-------------------------- | :----------------------------------------------------------- | :------------------------- |
| **VectorContextRetriever**  | **向量相似度检索**：先将查询文本转化为向量，在图谱中寻找向量相似的实体节点，再以该节点为中心获取其邻域关系上下文。 | 嵌入模型 (Embedding Model) |
| **LLMSynonymRetriever**     | **同义词扩展检索**：使用 LLM 将查询文本扩展为相关的关键词、别名或同义词，然后在图谱中匹配这些术语对应的实体，并获取上下文。 | 大语言模型 (LLM)           |
| **TextToCypherRetriever**   | **自然语言转 Cypher**：直接利用 LLM 将用户的自然语言问题翻译成 Cypher 查询语句，并在图数据库上执行。 | 大语言模型 (LLM)           |
| **CypherTemplateRetriever** | **模板填充检索**：预定义 Cypher 查询模板，利用 LLM 的结构化能力提取查询参数填入模板，然后执行。比 TextToCypher 更可控、安全。 | 大语言模型 (LLM)           |
| **CustomPGRetriever**       | **自定义逻辑检索**：基类接口，允许开发者编写任意 Python 代码来实现特定的检索逻辑（如结合外部 API、特定图算法等）。 | 无（取决于自定义实现）     |

#### 树索引

以下是树索引（Tree Index）四种检索模式的原理及依赖关系总结：

| 检索器名称                           | 原理说明                                                     | 核心依赖             |
| :----------------------------------- | :----------------------------------------------------------- | :------------------- |
| **TreeSelectLeafRetriever**          | **LLM 遍历检索**：从根节点逐层向下遍历，利用大模型判断每个节点的相关性，直到找到最相关的叶子节点。支持通过 `child_branch_factor` 参数控制是单选路径还是多选路径。 | 大语言模型 (LLM)     |
| **TreeSelectLeafEmbeddingRetriever** | **向量遍历检索**：逻辑同上（从根到叶逐层遍历），但区别在于判断节点相关性的方式由 LLM 变为**向量相似度匹配**。 | 嵌入模型 (Embedding) |
| **TreeAllLeafRetriever**             | **全量叶子返回**：忽略树的层级结构，直接获取并返回所有的叶子节点（原始内容）。 | 无（直接读取）       |
| **TreeRootRetriever**                | **全量根节点返回**：直接获取并返回所有的根节点（高层摘要）。 | 无（直接读取）       |

#### 关键词表索引

以下是关键词表索引（Keyword Table Index）三种检索器的原理及依赖关系说明：

| 检索器名称                      | 原理说明                                                     | 核心依赖             |
| :------------------------------ | :----------------------------------------------------------- | :------------------- |
| **KeywordTableGPTRetriever**    | **LLM 关键词提取**：使用大语言模型从用户查询中提取关键词，然后在索引的关键词表中进行匹配，找到包含这些关键词的节点。提取准确率高，能理解语义。 | 大语言模型 (LLM)     |
| **KeywordTableSimpleRetriever** | **正则表达式提取**：使用简单的正则规则（如按空格、标点符号分割）从查询中切分出关键词，再进行匹配。速度快，但对复杂查询的关键词识别能力较弱。 | 无（基于正则）       |
| **KeywordTableRAKERetriever**   | **RAKE 算法提取**：使用 RAKE（Rapid Automatic Keyword Extraction）算法自动从查询文本中提取关键短语。比简单正则更智能，能识别组合词，且无需调用模型。 | 无（基于 RAKE 算法） |
