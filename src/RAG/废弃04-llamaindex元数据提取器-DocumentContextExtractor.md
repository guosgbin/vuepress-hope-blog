---
title: 废弃04-llamaindex元数据提取器-DocumentContextExtractor
date: 2026-04-17 14:44:45
tags: 
  - RAG、metadata
categories:
  - RAG
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年04月17日14:45:05 |

## 作用

解决 RAG 中 **chunk 脱离上下文导致语义丢失** 的问题。

传统 RAG 的**固定长度分块策略**会将完整语义强行切割，导致：

- **孤立块问题**：一个只包含 "1945 年 8 月 15 日" 的块，检索系统无法知道这是日本投降日期
- **指代消解失败**："它"、"该方法"、"上述结论" 等指代在孤立块中完全失效
- **主题混淆**：不同章节的相似内容无法区分，导致检索返回无关段落

**DocumentContextExtractor** 是 LlamaIndex 官方实现的 **Contextual Retrieval（上下文检索）技术**，它为每个 chunk 的 metadata 加一个 context 字段，生成**文档级全局上下文描述**，让每个独立块都能 "知道" 自己在全文中的位置和语义角色。

*与其他上下文增强方法的对比*

| 方法                         | 原理                          | 效果提升   | 成本 | 局限性                         |
| ---------------------------- | ----------------------------- | ---------- | ---- | ------------------------------ |
| 重叠分块                     | 相邻块保留重叠区域            | 5-10%      | 低   | 重叠区域有限，无法获取全局信息 |
| 标题注入                     | 将文档 / 章节标题添加到每个块 | 10-15%     | 极低 | 信息单一，无法反映复杂语义关系 |
| 句子窗口                     | 检索句子后扩展到周围窗口      | 15-20%     | 低   | 只能获取局部上下文             |
| **DocumentContextExtractor** | 为每个块生成全局上下文描述    | **25-40%** | 中   | 需要额外 LLM 调用              |

## 原理

DocumentContextExtractor 的属性字段

| 属性名                      | 作用                                         |
| --------------------------- | -------------------------------------------- |
| llm                         | 你用的大模型（GPT等）                        |
| docstore                    | 存储完整原始文档，这是与其他提取器最大的区别 |
| key                         | 元数据的键名（存提取出来的上下文）           |
| prompt                      | 给大模型的提示词模板                         |
| doc_ids                     | 已经处理过的文档 ID                          |
| max_context_length          | 最大上下文长度（防超长）                     |
| max_output_tokens           | 生成的上下文最多多少字                       |
| oversized_document_strategy | 文档超长时的处理策略                         |

原理：

```
原始文档(Document)
    ↓
1. 添加到 DocStore（保存完整内容）
    ↓
2. 分割为文本块(Nodes)
    ↓
[DocumentContextExtractor.extract()]
    ↓
3. 遍历每个节点：
   a. 通过 node.relationships[NodeRelationship.SOURCE] 获取源文档ID
   b. 从 DocStore 中获取完整文档内容
   c. 截断完整文档到 max_context_length
   d. 使用 prompt 格式化输入（完整文档 + 当前块内容）
   e. 调用 LLM 生成上下文描述
    ↓
4. 将上下文描述添加到节点 metadata["context"]
    ↓
5. (可选) 拼接上下文与原始文本生成嵌入向量
    ↓
增强后的节点(Enhanced Nodes)
```





```
┌─────────────────────────────────────────────────┐
│  同一个文档的多个 chunk                         │
│  [chunk0] [chunk1] [chunk2] [chunk3] ...        │
└──────────────────┬──────────────────────────────┘
                   │
      每个 chunk 独立调用一次 LLM，prompt 结构：
                   │
    ┌──────────────┴──────────────────────────────┐
    │  User Message 1 (带 cache_control):          │
    │  <document>整个文档全文</document>           │
    │                                              │
    │  User Message 2 (每个 chunk 不同):            │
    │  Here is the chunk: <chunk>chunk内容</chunk>  │
    │  Please give a short succinct context to     │
    │  situate this chunk within the whole document │
    └──────────────┬──────────────────────────────┘
                   │
                   ▼
    LLM 输出: "这是文档第3节，讨论RAG的检索后处理阶段，
    包含重排序和过滤的具体方法"
                   │
                   ▼
    metadata["context"] = "..."  ← 写回 node
```

**核心设计：**

1. **Prompt Caching** — 整个文档内容放在第一个 `ChatMessage`，设置 `cache_control: ephemeral`。同一文档的多个 chunk 共享这个缓存，只有第二个 message（chunk 内容）需要重新推理。这是 Anthropic 的优化技巧，大幅降低 token 费用。
2. **按文档排序** — `aextract` 先按 `source_node.node_id` 排序，确保同一文档的 chunk 连续处理，prompt cache 命中率高。
3. **每个 chunk 独立 LLM 调用** — 不像 `TitleExtractor` 有合并阶段，每个 chunk 自己生成自己的 context，互不依赖。
4. **并发 + 限流保护** — 指数退避重试（60s, 120s, 240s...），最多 5 次。

------

## 三、与其他 Extractor 的对比

| Extractor                    | 输入                          | LLM 调用                           | 输出                             | 典型用途     |
| ---------------------------- | ----------------------------- | ---------------------------------- | -------------------------------- | ------------ |
| **DocumentContextExtractor** | 每个 chunk + **整个文档全文** | 每 chunk 1 次（共享 prompt cache） | `metadata["context"]` — 定位说明 | RAG 检索增强 |
| SummaryExtractor             | 每个 chunk 文本               | 每 chunk 1 次                      | `section_summary` — 摘要         | 文档理解     |
| TitleExtractor               | 每个 chunk 文本（前 N 个）    | 每 chunk 1 次 + 每 doc 1 次合并    | `document_title` — 标题          | 文档索引     |
| KeywordExtractor             | 每个 chunk 文本               | 每 chunk 1 次                      | `excerpt_keywords` — 关键词      | 过滤/检索    |

**关键区别：** `DocumentContextExtractor` 是唯一一个需要**传入整个文档全文**的 Extractor，其他都只看 chunk 自身。

------

## 四、关键参数

| 参数                          | 默认值                | 说明                                             |
| ----------------------------- | --------------------- | ------------------------------------------------ |
| `docstore`                    | **必填**              | 存完整文档的 docstore，用于获取全文              |
| `key`                         | `"context"`           | metadata 中存储的 key                            |
| `max_context_length`          | 1000                  | 文档 token 上限，超限按策略处理                  |
| `oversized_document_strategy` | `"warn"`              | 超限时 `warn`/`error`/`ignore`                   |
| `max_output_tokens`           | 512                   | context 最大输出 token 数                        |
| `prompt`                      | Anthropic 原版 prompt | 可替换为 `SUCCINCT_CONTEXT_PROMPT`（关键词风格） |

------

## 五、两个内置 prompt



```python
# ORIGINAL — 自然语言描述
"Please give a short succinct context to situate this chunk 
within the overall document for the purposes of improving 
search retrieval of the chunk."

# SUCCINCT — 关键词短语（推荐，更利于向量匹配）
"Generate keywords and brief phrases describing the main topics, 
entities, and actions in this text. Replace pronouns with their 
specific referents."
```

------

## 六、使用前置条件

需要一个 `docstore`，因为 Extractor 要通过 `node.source_node.node_id` 找到完整文档：



```python
from llama_index.core import SimpleDirectoryReader
from llama_index.core.storage.docstore import SimpleDocumentStore

docs = SimpleDirectoryReader(input_files=["data.txt"]).load_data()

# 把完整文档存入 docstore
docstore = SimpleDocumentStore()
for doc in docs:
    docstore.add_documents([doc])

# 切 chunk
parser = TokenTextSplitter(chunk_size=512, chunk_overlap=50)
nodes = parser.get_nodes_from_documents(docs)

# 提取 context
extractor = DocumentContextExtractor(
    docstore=docstore,
    llm=create_llm(),
    prompt=DocumentContextExtractor.SUCCINCT_CONTEXT_PROMPT,  # 关键词风格
    max_context_length=32000,  # 文档 token 上限
)

results = extractor.extract(nodes)
for node, meta in zip(nodes, results):
    node.metadata.update(meta)
```

------

## 七、成本注意

每个 chunk 调一次 LLM，**每次请求都带上整个文档全文**。靠 prompt caching 省 token，但文档越长、chunk 越多，费用越高。适合文档不太长（< 30K tokens）、chunk 数量适中的场景。
