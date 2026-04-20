---
title: 06-llamaindex数据分割
date: 2026-04-20 10:38:58
tags: 
  - RAG
categories:
  - RAG
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年04月20日10:39:01 |

## 基本概念

数据分割（节点解析）的目标是将长文档拆分为**大小适中、语义完整、可独立检索**的文本块（Node），解决 LLM 上下文窗口限制和检索精度问题。数据分割是**RAG 系统性能的第一决定因素**，直接影响检索准确率和生成质量。LlamaIndex 将所有分割逻辑抽象为 `NodeParser` 接口，提供了从简单文本分割到语义感知、结构感知的全栈解决方案。

## llamaindex 分割器的整体架构

```
TransformComponent (基类)
    |
    +-- NodeParser (ABC)                         # 所有解析器的顶层抽象
            |
            +-- TextSplitter (ABC)               # 基于"切文本→建Node"的模式
            |       |
            |       +-- MetadataAwareTextSplitter # 额外支持 metadata-aware 切分
            |               |
            |               +-- TokenTextSplitter
            |               +-- SentenceSplitter
            |               +-- CodeSplitter
            |               +-- LangchainNodeParser
            |
            +-- SentenceWindowNodeParser          # 单句检索+上下文窗口
            +-- SemanticSplitterNodeParser        # 语义相似度切分
            +-- SemanticDoubleMergingSplitterNodeParser  # 双向语义合并
            +-- MarkdownNodeParser                # 按 Markdown 标题层级切分
            +-- HTMLNodeParser                    # 按 HTML 标签切分
            +-- JSONNodeParser                    # 按 JSON 结构切分
            +-- SimpleFileNodeParser              # 自动按扩展名路由
            +-- HierarchicalNodeParser            # 多层级父子关系切分
            +-- BaseElementNodeParser (ABC)       # 表格/元素提取
```

核心入口方法统一为 `get_nodes_from_documents(docs)`，返回 `List[TextNode]`。

## 分割器的使用

### 直接使用

```python
docs = [Document(text="""
网络强国是中国政治术语，既指将建设网络强国作为国家战略，也指国家在网络技术、产业、安全、治理等领域达到国际领先状态 [1-2] [12]。
该战略旨在通过自主创新提升核心技术竞争力，构建与经济实力相匹配的网络产业规模，完善网络安全保障体系，并形成具有全球示范性的治理模式 [3] [9-10]。网络强国涉及技术、网络、应用、文化、安全、立法、监管等诸多方面 [5]。
中国自2013年起将网络强国纳入国家战略，2014年习近平总书记明确提出“从网络大国迈向网络强国”目标 [8] [14]。2021年《习近平关于网络强国论述摘编》系统阐述了战略理论框架，强调核心技术突破、依法治网和网络空间命运共同体等核心理念 [2] [11] [13]。截至2023年，中国网民规模达10.92亿，互联网普及率77.5%，建成全球最大5G网络（基站总数337.7万个） [7] [15]。2025年，党的二十届四中全会提出加快建设网络强国 [17]。同年，习近平总书记强调网络生态治理是网络强国建设的重要任务，要健全网络生态治理长效机制 [16]。当前，中国在数字基础设施规模、数字经济等领域位居前列，但在芯片、操作系统等核心技术上仍存差距 [3-4] [6]。
""")]

# 1. 创建分割器
splitter = TokenTextSplitter(chunk_size=256, chunk_overlap=20)

# 2. 切分文档 → 返回 List[TextNode]
nodes = splitter.get_nodes_from_documents(docs)

# 3. 查看结果
for node in nodes:
    print(f"--- {len(node.text)} chars ---")
    print(node.text[:100])
    print(f"metadata: {node.metadata}")
    print(f"start_idx: {node.start_char_idx}, end_idx: {node.end_char_idx}")
```

*输出*

```
--- 239 chars ---
网络强国是中国政治术语，既指将建设网络强国作为国家战略，也指国家在网络技术、产业、安全、治理等领域达到国际领先状态 [1-2] [12]。
该战略旨在通过自主创新提升核心技术竞争力，构建与经济实力相匹
metadata: {}
start_idx: 5, end_idx: 244
--- 225 chars ---
[8] [14]。2021年《习近平关于网络强国论述摘编》系统阐述了战略理论框架，强调核心技术突破、依法治网和网络空间命运共同体等核心理念 [2] [11] [13]。截至2023年，中国网民规模达1
metadata: {}
start_idx: 241, end_idx: 466
--- 62 chars ---
[16]。当前，中国在数字基础设施规模、数字经济等领域位居前列，但在芯片、操作系统等核心技术上仍存差距 [3-4] [6]。
metadata: {}
start_idx: 467, end_idx: 529
```

### 嵌入到其他组件使用

数据分割器可以作为参数传入其他组件，组件在运行时会自动调用它来解析、拆分 Document。例如直接用 Document 构建向量存储索引时，把数据分割器设为转换器，索引就会在构建前自动将 Document 切分成多个 Node。

```python
llm = OllamaEmbedding(model_name="qwen3-embedding:0.6b", base_url="http://localhost:11434")

docs = [Document(text="""
网络强国是中国政治术语，既指将建设网络强国作为国家战略，也指国家在网络技术、产业、安全、治理等领域达到国际领先状态 [1-2] [12]。
该战略旨在通过自主创新提升核心技术竞争力，构建与经济实力相匹配的网络产业规模，完善网络安全保障体系，并形成具有全球示范性的治理模式 [3] [9-10]。网络强国涉及技术、网络、应用、文化、安全、立法、监管等诸多方面 [5]。
中国自2013年起将网络强国纳入国家战略，2014年习近平总书记明确提出“从网络大国迈向网络强国”目标 [8] [14]。2021年《习近平关于网络强国论述摘编》系统阐述了战略理论框架，强调核心技术突破、依法治网和网络空间命运共同体等核心理念 [2] [11] [13]。截至2023年，中国网民规模达10.92亿，互联网普及率77.5%，建成全球最大5G网络（基站总数337.7万个） [7] [15]。2025年，党的二十届四中全会提出加快建设网络强国 [17]。同年，习近平总书记强调网络生态治理是网络强国建设的重要任务，要健全网络生态治理长效机制 [16]。当前，中国在数字基础设施规模、数字经济等领域位居前列，但在芯片、操作系统等核心技术上仍存差距 [3-4] [6]。
""")]

index = VectorStoreIndex.from_documents(embed_model=llm,
                                    documents=docs,
                                    show_progress=True,
                                    transformations=[TokenTextSplitter(chunk_size=256, chunk_overlap=20)])
pprint.pprint(index.docstore.docs)
```

*输出*

```
Applying transformations: 100%|██████████| 1/1 [00:00<00:00, 399.84it/s]
Generating embeddings: 100%|██████████| 3/3 [00:00<00:00,  5.42it/s]
{'8d029613-9dc2-4eb9-be8e-0ce2e0e704c5': TextNode(id_='8d029613-9dc2-4eb9-be8e-0ce2e0e704c5', embedding=None, metadata={}, excluded_embed_metadata_keys=[], excluded_llm_metadata_keys=[], relationships={<NodeRelationship.SOURCE: '1'>: RelatedNodeInfo(node_id='2d16de00-31b9-402d-8e48-7d5e85364490', node_type='4', metadata={}, hash='faa5820ba16ee16b3db92d95e523f6ac0739e1ae987cb2d5bf54db45c19c745f'), <NodeRelationship.PREVIOUS: '2'>: RelatedNodeInfo(node_id='906dc318-1a6c-4804-af69-4e9e202f6efc', node_type='1', metadata={}, hash='7482f1bbb9ddb3c38a6c5f91ef788f66e596954864a7715393e9615532c1dd16'), <NodeRelationship.NEXT: '3'>: RelatedNodeInfo(node_id='b30b1539-2e11-4d65-b216-087c18feb8a2', node_type='1', metadata={}, hash='5c0e20b8cc020462934bc5b137c56f7607fff47e488e01650fb071a24e2aacc3')}, metadata_template='{key}: {value}', metadata_separator='\n', text='[5]。\n    中国自2013年起将网络强国纳入国家战略，2014年习近平总书记明确提出“从网络大国迈向网络强国”目标 [8] [14]。2021年《习近平关于网络强国论述摘编》系统阐述了战略理论框架，强调核心技术突破、依法治网和网络空间命运共同体等核心理念 [2] [11] [13]。截至2023年，中国网民规模达10.92亿，互联网普及率77.5%，建成全球最大5G网络（基站总数337.7万个） [7] [15]。2025年，党的二十届四中全会提出加快建设网络强国', mimetype='text/plain', start_char_idx=192, end_char_idx=429, text_template='{metadata_str}\n\n{content}'),
 '906dc318-1a6c-4804-af69-4e9e202f6efc': TextNode(id_='906dc318-1a6c-4804-af69-4e9e202f6efc', embedding=None, metadata={}, excluded_embed_metadata_keys=[], excluded_llm_metadata_keys=[], relationships={<NodeRelationship.SOURCE: '1'>: RelatedNodeInfo(node_id='2d16de00-31b9-402d-8e48-7d5e85364490', node_type='4', metadata={}, hash='faa5820ba16ee16b3db92d95e523f6ac0739e1ae987cb2d5bf54db45c19c745f'), <NodeRelationship.NEXT: '3'>: RelatedNodeInfo(node_id='8d029613-9dc2-4eb9-be8e-0ce2e0e704c5', node_type='1', metadata={}, hash='a032fe90ae31953b117b5e31864db8b1da5459f2ae4edbb5f118d6ab9a81e35d')}, metadata_template='{key}: {value}', metadata_separator='\n', text='网络强国是中国政治术语，既指将建设网络强国作为国家战略，也指国家在网络技术、产业、安全、治理等领域达到国际领先状态 [1-2] [12]。\n    该战略旨在通过自主创新提升核心技术竞争力，构建与经济实力相匹配的网络产业规模，完善网络安全保障体系，并形成具有全球示范性的治理模式 [3] [9-10]。网络强国涉及技术、网络、应用、文化、安全、立法、监管等诸多方面 [5]。', mimetype='text/plain', start_char_idx=9, end_char_idx=196, text_template='{metadata_str}\n\n{content}'),
 'b30b1539-2e11-4d65-b216-087c18feb8a2': TextNode(id_='b30b1539-2e11-4d65-b216-087c18feb8a2', embedding=None, metadata={}, excluded_embed_metadata_keys=[], excluded_llm_metadata_keys=[], relationships={<NodeRelationship.SOURCE: '1'>: RelatedNodeInfo(node_id='2d16de00-31b9-402d-8e48-7d5e85364490', node_type='4', metadata={}, hash='faa5820ba16ee16b3db92d95e523f6ac0739e1ae987cb2d5bf54db45c19c745f'), <NodeRelationship.PREVIOUS: '2'>: RelatedNodeInfo(node_id='8d029613-9dc2-4eb9-be8e-0ce2e0e704c5', node_type='1', metadata={}, hash='a032fe90ae31953b117b5e31864db8b1da5459f2ae4edbb5f118d6ab9a81e35d')}, metadata_template='{key}: {value}', metadata_separator='\n', text='[17]。同年，习近平总书记强调网络生态治理是网络强国建设的重要任务，要健全网络生态治理长效机制 [16]。当前，中国在数字基础设施规模、数字经济等领域位居前列，但在芯片、操作系统等核心技术上仍存差距 [3-4] [6]。', mimetype='text/plain', start_char_idx=430, end_char_idx=541, text_template='{metadata_str}\n\n{content}')}
```

## 核心流程：从 Document 到 Node

**`NodeParser.get_nodes_from_documents`** 内部是两阶段处理：

```python
def get_nodes_from_documents(self, documents, show_progress=False, **kwargs):
    # Phase 1: 调用子类的 _parse_nodes() 生成原始 Node
    nodes = self._parse_nodes(documents, show_progress, **kwargs)
    # Phase 2: 后处理——元数据继承 + 前后节点关系
    nodes = self._postprocess_parsed_nodes(nodes, doc_id_to_document)
    return nodes
```

**Phase 2 的 `_postprocess_parsed_nodes` 做了三件事：**

1. **元数据继承**：如果 `include_metadata=True`，把 Document 的 metadata 合并到每个 Node：`node.metadata = {**doc.metadata, **node.metadata}`
2. **字符索引定位**：通过字符串搜索找到每个 chunk 在原文中的 `start_char_idx` 和 `end_char_idx`，支持源文本回溯
3. **前后节点关系**：如果 `include_prev_next_rel=True`，同一来源的连续 chunk 会被链上 `PREVIOUS` / `NEXT` 关系

## 文本分割的底层方法

在 LlamaIndex 框架中，对 Document 对象的文本分割方法有 4 种。无论使用什么类型的文本分割器，基础的文本分割都是用这 4 种方法之一或它们的组合。

这些函数都在 `llama_index/core/node_parser/text/utils.py` 中，全部返回 `Callable[[str], List[str]]` 闭包。

### split_by_sep-固定分隔符分割

*源码*

```python
def split_text_keep_separator(text: str, separator: str) -> List[str]:
    parts = text.split(separator)
    result = [separator + s if i > 0 else s for i, s in enumerate(parts)]
    return [s for s in result if s]

def split_by_sep(sep: str, keep_sep: bool = True) -> Callable[[str], List[str]]:
    if keep_sep:
        return lambda text: split_text_keep_separator(text, sep)
    else:
        return lambda text: text.split(sep)
```

*原理*：

- Python 原生 `str.split()` 会丢弃分隔符，但分隔符（如 `\n`）本身是有意义的
- `split_text_keep_separator` 把分隔符**贴到下一个片段的开头**（`separator + s`），保留语义边界
- 最后过滤掉空字符串

*实战*：

```python
fn = split_by_sep("\n\n\n", keep_sep=True)
text = "第一段\n\n\n第二段\n\n\n第三段"
print(fn(text))
# ['第一段', '\n\n\n第二段', '\n\n\n第三段']

# keep_sep=False 时
fn2 = split_by_sep("\n\n\n", keep_sep=False)
print(fn2(text))
# ['第一段', '第二段', '第三段']  ← 分隔符丢失
```

### split_by_sentence_tokenizer-句子边界分割

*源码*：

```python
def split_by_sentence_tokenizer_internal(text: str, tokenizer) -> List[str]:
    spans = list(tokenizer.span_tokenize(text))
    sentences = []
    for i, span in enumerate(spans):
        start = span[0]
        if i < len(spans) - 1:
            end = spans[i + 1][0]  # 下一句的起点作为本句终点
        else:
            end = len(text)
        sentences.append(text[start:end])
    return sentences

def split_by_sentence_tokenizer():
    return lambda text: split_by_sentence_tokenizer_internal(
        text, globals_helper.punkt_tokenizer
    )
```

**原理**：

- 使用 NLTK 的 `PunktSentenceTokenizer`（基于训练的句子边界检测模型）
- `span_tokenize` 返回每句话的 `(start, end)` 字符偏移
- **关键技巧**：本句的 `end` 不是句号的结束位置，而是**下一句的 start**，这样句子之间的空格/换行会留在前一句的尾部

> 注意：**NLTK 的 `PunktSentenceTokenizer` 对中文支持很弱。**
>
> 它主要基于英文训练，识别的句边界标记是 `.` `!` `?` 等英文标点，不认识中文的 `。` `！` `？` `；`。

**实战**：

```python
fn = split_by_sentence_tokenizer()
text = "Hello world. How are you? Fine."
print(fn(text))
# ['Hello world. ', 'How are you? ', 'Fine.']
#          ↑ 注意空格被保留在前一句尾部
```

### split_by_regex-正则表达式匹配分割

*源码*

```python
def split_by_regex(regex: str) -> Callable[[str], List[str]]:
    return lambda text: re.findall(regex, text)

def split_by_phrase_regex():
    return split_by_regex("[^,.;。]+[,.;。]?")
```

*原理*：

- 不用 `re.split()`，而是用 `re.findall()` —— 只**提取匹配的部分**，不匹配的直接丢弃
- `[^,.;。]+[,.;。]?` 的含义：捕获"非标点字符 + 可选的一个标点结尾"
- 中英文标点都支持：`。！？，,.;`

*实战*：

```python
fn = split_by_regex("[^,.;。]+[,.;。]?")
text = "RAG是一种技术。它结合了检索和生成，效果很好。"
print(fn(text))
# ['RAG是一种技术。', '它结合了检索和生成，', '效果很好。']
```

### split_by_char-逐字符分割

*源码*

```python
def split_by_char() -> Callable[[str], List[str]]:
    return lambda text: list(text)
```

**作用**：当所有高级分割方法都失败时（比如文本就是一大段没有任何标点），退化为逐个字符切分，确保不会卡死。

```python
fn = split_by_char()
text = "RAG是一种技术。它结合了检索和生成，效果很好。"
print(fn(text))
# ['R', 'A', 'G', '是', '一', '种', '技', '术', '。', '它', '结', '合', '了', '检', '索', '和', '生', '成', '，', '效', '果', '很', '好', '。']
```

## 理解chunk_size和chunk_overlap

### chunk_size-每个 chunk 的最大 token 数

**定义**：一个 chunk 中最多包含多少个 token（不是字符数，是 token 数）。

```
chunk_size = 100
```

意味着每个切分后的文本块最多包含 100 个 token。

**为什么用 token 而不是字符**：LLM 的上下文窗口是按 token 计算的（比如 gpt-4 最大 128K tokens）。用 token 控制 chunk 大小，能确保每个 chunk 放进 prompt 时不会超出模型限制。

**token 和字符的换算**（近似）：

- 英文：1 token ≈ 0.75 个单词 ≈ 4 个字符
- 中文：1 token ≈ 1~2 个汉字

所以 `chunk_size=100` 的中文文本大约 100~200 个汉字。

> 注意：实际限定的文本块的大小会比 chunk_size 参数值更小一些， 它会去掉 Node 对象包含的元数据的大小（也是用 token 来衡量的） 。这是由于元数据会默认和 Node 对象的文本内容一起用于构造索引并输入大模型中。

------

### chunk_overlap-相邻 chunk 的重叠 token 数

**定义**：相邻两个 chunk 之间，后一个 chunk 要包含前一个 chunk 末尾多少个 token。

```
chunk_size = 100
chunk_overlap = 20
```

```
Chunk 0: [token 0   ─────────────────── token 99]
Chunk 1: [token 80  ───────────── token 179]
Chunk 2: [token 160 ───────────── token 259]
                                            ↑ 20 token 重叠
```

**为什么需要 overlap**：避免关键信息被切在边界处丢失上下文。

```python
text = "张三说李四是王五的朋友，他们一起在杭州工作"

# 假设 chunk_size 很小，不重叠：
# Chunk 0: "张三说李四是"        ← 话没说完
# Chunk 1: "王五的朋友，他们"    ← 丢失了"张三说"的上下文
# Chunk 2: "一起在杭州工作"     ← 不知道"他们"是谁

# 有 overlap：
# Chunk 0: "张三说李四是王五的朋友，"
# Chunk 1: "五的朋友，他们一起在杭州工作"
#         ↑ "五的朋友" 重叠，保留了连接点
```

------

### 两者关系

```
有效新信息量 = chunk_size - chunk_overlap
```

| chunk_size | chunk_overlap | 每次前进 token 数 | 效果                                |
| ---------- | ------------- | ----------------- | ----------------------------------- |
| 256        | 0             | 256               | 无重叠，边界信息可能丢失            |
| 256        | 20            | 236               | 适度重叠，推荐默认值                |
| 256        | 128           | 128               | 大量重叠，检索冗余但上下文丰富      |
| 256        | 256           | 0                 | 完全重复，所有 chunk 一样（无意义） |

**经验法则**：

- `chunk_overlap` 一般设为 `chunk_size` 的 10%~20%
- 中文建议 overlap 稍微大一点（因为中文语义连贯性强，切分容易断语义）
- `chunk_overlap >= chunk_size` 没有意义

## 常见的数据分割器

### TokenTextSplitter-按 Token 切分

**原理**：基于 tiktoken 分词，按 token 数量控制 chunk 大小，支持 overlap。

**核心流程**（`_split_text` 方法）：

1. 如果全文 token 数 ≤ `chunk_size`，直接返回
2. **Split 阶段**：用 separator → backup separators → 逐字符，逐级降级切分
3. **Merge 阶段**：累积 split 片段直到超过 `chunk_size`，然后从前一个 chunk 的开头 pop token 直到剩余 ≤ `chunk_overlap`，作为新 chunk 的起始

```python
splitter = TokenTextSplitter(
    chunk_size=256,       # 每块目标 token 数
    chunk_overlap=20,     # 相邻块重叠 token 数
    separator=" ",        # 首选分隔符
    backup_separators=["\n"],  # 备用分隔符
    keep_whitespaces=False
)
```

**适用场景**：通用文本、对 token 数量有严格限制的场景（如嵌入模型上下文窗口）。

*案例*

```python
docs = [Document(text="""
张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车。我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......\n
从设计到制造，从测试到交付，每一个环节都精益求精。我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往。
""")]

splitter = TokenTextSplitter(chunk_size=100, chunk_overlap=10, separator="\n", backup_separators=["。"])
nodes = splitter.get_nodes_from_documents(docs)
for node in nodes:
    print(node.model_dump_json())
```

### SentenceSplitter-按句子切分

**原理**：分层切分策略，优先保持句子完整性。

**split 函数优先级**（从高到低）：

1. 段落分割符 `\n\n\n`
2. NLTK 句子分词器（`punkt`）
3. 正则分割（按 `[,.;。？！]` 等标点）
4. 空格分割
5. 逐字符（最后手段）

**Merge 阶段的特殊处理**：

- 用 `is_sentence` 标志标记每个 split 是否来自"真正的句子分割"
- 如果当前 chunk 加上新 split 不超过 `chunk_size`，直接添加
- 如果是**新 chunk 的第一块**，即使超过也允许添加（保证不会有孤立句子被丢弃）
- overlap 从上一个 chunk 的**末尾反向取**，拼接到新 chunk 开头

```python
splitter = SentenceSplitter(
    chunk_size=1024,
    chunk_overlap=200,
    separator=" ",
    paragraph_separator="\n\n\n",
    secondary_chunking_regex="[^\.;。]+[\.;。]|[^\;；]+[;；]|[^，,]+[，,]"
)
```

**适用场景**：绝大多数 RAG 场景的默认选择，保证句子完整性，语义连贯性好。

*案例*：

```python
docs = [Document(
    # text="***Google公司介绍***Google是一家搜索引擎与云计算公司***总部位于美国加利福尼亚州山景城。主要产品是搜索引擎、广告服务、企业服务、云计算等。")]
    text="***张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车。我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......***从设计到制造，从测试到交付，每一个环节都精益求精。我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往。")]
node_parser = SentenceSplitter(chunk_size=100,
                               chunk_overlap=10,
                               paragraph_separator="***",
                               chunking_tokenizer_fn=my_chunking_tokenizer_fn,
                               secondary_chunking_regex="[^,.;。？！]+[,.;。？！]?",
                               separator="\n")
nodes = node_parser.get_nodes_from_documents(docs)
for node in nodes:
    print("*" * 100)
    print(node)
```

### SentenceWindowNodeParser-句子窗口

**原理**：把文档拆成**单句 Node**，但每个 Node 的 metadata 里存入前后文窗口。

```python
parser = SentenceWindowNodeParser(
    window_size=3,   # 前后各取 3 句
    window_metadata_key="window",
    original_text_metadata_key="original_text"
)

nodes = parser.get_nodes_from_documents(docs)
# 每个 node.text = 单句
# node.metadata["window"] = 前3句 + 本句 + 后3句
# node.metadata["original_text"] = 本句
```

**为什么这样设计**：检索时匹配的是**单句**（更精确），但 LLM 回答时能看到**上下文窗口**（更完整）。

**适用场景**：需要高精度检索 + 丰富上下文回复的场景。

*案例*

```python
# 自定义一个分割文本的函数
def my_chunking_tokenizer_fn(text: str):
    # 跟踪是否进入本方法
    print('start my chunk tokenizer function...')
    sentence_delimiters = re.compile(u'[。！？]')
    sentences = sentence_delimiters.split(text)
    return [s.strip() for s in sentences if s]


docs = [Document(text="张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车。我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......\n从设计到制造，从测试到交付，每一个环节都精益求精。我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往。")]
splitter = SentenceWindowNodeParser(
    window_size=1,
    sentence_splitter=my_chunking_tokenizer_fn
)
nodes = splitter.get_nodes_from_documents(docs)


print("Count of nodes:", len(nodes))
for node in nodes:
    print("*" * 100)
    print(node.get_metadata_str())
    print("*" * 100)
    print(node.get_content())
    print("*" * 100)
```

*输出*

```
start my chunk tokenizer function...
Count of nodes: 3
****************************************************************************************************
window: 张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车 我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......
从设计到制造，从测试到交付，每一个环节都精益求精
original_text: 张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车
****************************************************************************************************
张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车
****************************************************************************************************
****************************************************************************************************
window: 张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车 我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......
从设计到制造，从测试到交付，每一个环节都精益求精 我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往
original_text: 我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......
从设计到制造，从测试到交付，每一个环节都精益求精
****************************************************************************************************
我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......
从设计到制造，从测试到交付，每一个环节都精益求精
****************************************************************************************************
****************************************************************************************************
window: 我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......
从设计到制造，从测试到交付，每一个环节都精益求精 我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往
original_text: 我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往
****************************************************************************************************
我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往
****************************************************************************************************
```

> 注意：
>
> （1）与其他元数据不一样的是，这个 window 的内容默认对嵌入模型或者大模型不可见。
>
> （2）不建议把 window 的内容输入嵌入模型。嵌入应该只针对本 Node 对象的文本内容，这样有利于语义的细分，可以提高后面检索的精确度。
>
> （3）建议把 Node 内容替换成 window 包含的内容发送到大模型用于生成，以帮助大模型获得更多的上下文，提高生成质量。

### HierarchicalNodeParser-多层级切分

**原理**：用多个分割器逐层切分，建立父子关系。

```python
from llama_index.core.node_parser import HierarchicalNodeParser, TokenTextSplitter

parser = HierarchicalNodeParser.from_defaults(
    chunk_sizes=[2048, 512, 128]  # 三层：大 → 中 → 小
)
nodes = parser.get_nodes_from_documents(docs)
```

内部自动创建 3 个 `SentenceSplitter`，第 1 层用 2048 tokens，第 2 层用 512，第 3 层用 128。然后建立 `PARENT` / `CHILD` 关系。

**辅助函数**：

```python
from llama_index.core.node_parser import get_leaf_nodes, get_root_nodes, get_child_nodes

leaf_nodes = get_leaf_nodes(nodes)   # 最细粒度的 chunk（用于检索）
root_nodes = get_root_nodes(nodes)   # 最粗粒度的 chunk（用于上下文）
```

**适用场景**：配合 `AutoMergingRetriever` 使用——检索到子节点时，如果命中多个子节点属于同一父节点，自动合并返回父节点。

**案例**：

```python
docs = [Document(text="""
    张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车。
    我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......\n
    从设计到制造，从测试到交付，每一个环节都精益求精。我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往。
""")]
node_parser = HierarchicalNodeParser.from_defaults(
    chunk_sizes=[1024, 100, 50]
)
nodes = node_parser.get_nodes_from_documents(docs)

print("Count of nodes:", len(nodes))
for node in nodes:
    print("id: ", node.node_id)
    print("content:", node.get_content())
    child_ids = [c.node_id for c in node.relationships.get(NodeRelationship.CHILD, [])]
    print("child ids:", child_ids)
    print("*" * 100)
```

**输出**：

```
Count of nodes: 10
id:  664c6fe4-5b8c-4527-b04a-2fc2f7b5b059
content: 张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车。
        我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......

        从设计到制造，从测试到交付，每一个环节都精益求精。我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往。
child ids: ['b7203633-2eac-44ac-815f-e89baa14c1f4', '4742427d-cfac-4261-b3bd-72df25b379e9', '2ee55dc9-512b-401e-8761-78c9dc4b028d']
****************************************************************************************************
id:  b7203633-2eac-44ac-815f-e89baa14c1f4
content: 张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车。
child ids: ['0357e410-8724-4c5c-97b8-c57fb6a7f330']
****************************************************************************************************
id:  4742427d-cfac-4261-b3bd-72df25b379e9
content: 我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......
child ids: ['c84328d8-54b8-4a10-af03-08f9b147972c', '82835d0e-7313-4657-9d97-98baa6877721', '1946e082-e42d-44f6-b511-a74e6b39b3f8']
****************************************************************************************************
id:  2ee55dc9-512b-401e-8761-78c9dc4b028d
content: 1......

        从设计到制造，从测试到交付，每一个环节都精益求精。我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往。
child ids: ['f65baf26-1b9e-4d92-b477-be0f4a6b46cf', '97ab34cc-5d12-45b2-9fb8-ed2e6cda60f5']
****************************************************************************************************
id:  0357e410-8724-4c5c-97b8-c57fb6a7f330
content: 张雪机车成立于2024年，致力于打造具有中国智造特色的高性能摩托车。
child ids: []
****************************************************************************************************
id:  c84328d8-54b8-4a10-af03-08f9b147972c
content: 我们以热爱为驱动，以技术创新为基石，让每一台ZXMOTO都承载着中国速度的梦
child ids: []
****************************************************************************************************
id:  82835d0e-7313-4657-9d97-98baa6877721
content: ZXMOTO都承载着中国速度的梦想，2026年，让全世界爱上张雪机车魅力，速度
child ids: []
****************************************************************************************************
id:  1946e082-e42d-44f6-b511-a74e6b39b3f8
content: 全世界爱上张雪机车魅力，速度与激情，张雪机车No.1......
child ids: []
****************************************************************************************************
id:  f65baf26-1b9e-4d92-b477-be0f4a6b46cf
content: 1......

        从设计到制造，从测试到交付，每一个环节都精益求精。
child ids: []
****************************************************************************************************
id:  97ab34cc-5d12-45b2-9fb8-ed2e6cda60f5
content: 我们相信，真正的机车文化不仅仅是速度与激情，更是对品质生活的追求和对自由精神的向往。
child ids: []
****************************************************************************************************
```

可以看到，在 chunk_size = 1024 的粒度上分割了 1 个 Node 节点，在 chunk_size=100 的粒度上有 3 个 Node 节点，在 chunk_size = 50 的粒度上有 6 个节点。

### SemanticSplitterNodeParser-语义相似度切分

SemanticSplitterNodeParser 不按标点/字符切分，而是用嵌入模型计算句子间的语义相似度，相似度高的合并到一起，相似度低的作为切分边界。

**和其他分割器的本质区别**：

| 维度       | 传统分割器                     | SemanticSplitter           |
| ---------- | ------------------------------ | -------------------------- |
| 切分依据   | 字符/句子/token 等**形式边界** | 语义相似度                 |
| chunk 大小 | 固定（chunk_size）             | 动态（语义决定）           |
| 核心问题   | "切在哪个字符？"               | "这两句话说的是一件事吗？" |

**工作流程**：

```
文档 → 拆成句子 → 每句 + buffer 做 embedding
    → 计算相邻句子对的余弦距离
    → 距离突变处（超过阈值百分位）= 切分边界
    → 距离平缓处 = 合并为一个 Node
```

**适合场景**：同一篇文章包含多个不相关话题（如会议记录、多人博客聚合），让语义主题变化处自然成为切分点。

```python
from llama_index.embeddings.openai import OpenAIEmbedding

splitter = SemanticSplitterNodeParser(
    embed_model=OllamaEmbedding(model_name="qwen3-embedding:0.6b", base_url="http://localhost:11434"),
    buffer_size=1,                    # 前后各取 1 句做 buffer
    breakpoint_percentile_threshold=95,  # 距离 > 95 百分位才切
)
```

**核心源码**：

```python
distances = self._calculate_distances(combined_embeddings)
breakpoint_distance_threshold = np.percentile(distances, self.breakpoint_percentile_threshold)
indices_above_threshold = [i for i, x in enumerate(distances) if x > breakpoint_distance_threshold]
```

**调参**：`breakpoint_percentile_threshold` 越低 → 切得越细；越高 → 切得越粗。

这是用于控制句子语义相关性的一个阈值，可以理解成上下文句子的向量距离的阈值，向量距离大于这个阈值就会被分割。因此，这个值越大，生成的文本块越少；这个值越小，生成的文本块越多

**适用场景**：内容主题变化频繁的长文档（如会议记录、多话题文章），让语义变化处自然成为切分点。



案例：

```python
docs = SimpleDirectoryReader(input_files=["../../data/JavaInterview.txt"]).load_data()
    embed_model = OllamaEmbedding(model_name="qwen3-embedding:0.6b")
    splitter = SemanticSplitterNodeParser(
        breakpoint_percentile_threshold=20,
        buffer_size=2,
        embed_model=embed_model
    )
    nodes = splitter.get_nodes_from_documents(docs)
    print("Count of nodes:", len(nodes))
    for node in nodes:
        print("id: ", node.node_id)
        # print(node.get_metadata_str(MetadataMode.ALL))
        print(node.get_content())
        # print(node.relationships)
        print("*" * 100)
```

breakpoint_percentile_threshold 赋值为 85，输出的节点数量为：13

breakpoint_percentile_threshold 赋值为 20，输出的节点数量为：64

### MarkdownNodeParser-按标题层级切分

**原理**：逐行解析 Markdown，遇到标题就切分。维护一个 `header_stack` 跟踪标题层级。

```python
from llama_index.core.node_parser import MarkdownNodeParser

parser = MarkdownNodeParser()
nodes = parser.get_nodes_from_documents(docs)
# 每个 node.metadata["header_path"] = "/## 安装/### 配置/"
```

切分时机：遇到新标题时，把上一个标题下的内容保存为 Node，然后更新 `header_stack`。

**适用场景**：技术文档、API 文档等结构化 Markdown 文件。每个 chunk 自带标题路径元数据。

------

### HTMLNodeParser-按 HTML 标签切分

```python
from llama_index.core.node_parser import HTMLNodeParser

parser = HTMLNodeParser(
    tags=["p", "h1", "h2", "h3", "li", "section"]  # 只提取这些标签
)
```

用 BeautifulSoup 解析 HTML，按标签分组。连续相同标签合并为一个 Node。

### CodeSplitter-按代码 AST 切分

**原理**：用 tree-sitter 把代码解析成 AST（抽象语法树），按语法节点边界切分，保证每个 chunk 是语法完整的代码块。

**核心逻辑**：

```python
def _chunk_node(self, node, children, max_size, current_chunk=None):
    for child in children:
        child_size = self._get_size(child)
        if child_size > max_size:
            # 子节点太大，递归细分
            self._chunk_node(child, child.children, max_size, current_chunk)
        elif current_size + child_size > max_size:
            # 当前 chunk 满了，保存并开始新 chunk
            chunks.append(current_chunk)
            current_chunk = [child]
        else:
            current_chunk.append(child)
```



```python
splitter = CodeSplitter(
    language="python",       # 支持 python, javascript, java, go 等
    chunk_lines=40,          # 目标行数
    chunk_lines_overlap=15,  # 重叠行数
    max_chars=1500,          # 最大字符数
)
```

**适用场景**：代码检索、代码 RAG。比按行/按 token 切分好得多，因为不会把一个函数切到一半。

**案例**

```python
docs = FlatReader().load_data(Path("../../data/BiliBiliContentReader.py"))
code_parser = CodeSplitter(
    language="python",  # 支持 python, javascript, java, go 等
    chunk_lines=40,  # 目标行数
    chunk_lines_overlap=15,  # 重叠行数
    max_chars=1500,  # 最大字符数
)
nodes = code_parser.get_nodes_from_documents(docs)
print("Count of nodes:", len(nodes))
for node in nodes:
    print("id: ", node.node_id)
    print(node.get_content())
    print("*" * 100)
```

*输出*

```
id:  412a6fef-3eb7-4e9d-ad5b-5cf00cc66368
import warnings
from typing import Any, List

from llama_index.core.readers.base import BaseReader
from llama_index.core.schema import Document
****************************************************************************************************
id:  fcb185c8-11d8-402f-b847-ef43ee85a449
class BilibiliDanmakuReader(BaseReader):
****************************************************************************************************
id:  aa1cceff-ecba-40f3-8bd2-a91b33b29b6e
"""Bilibili danmaku info reader."""

    @staticmethod
    def get_bilibili_danmaku(bili_url):
        """抓取 B站视频弹幕列表。

        原理：
        1. 通过 bilibili_api 获取视频 cid（弹幕容器 ID）
        2. 按分段调用 video.get_danmakus() 获取每段弹幕
        3. 返回格式化的弹幕文本（时间戳 + 内容 + 弹幕类型）
        """
        import math
        import re

        from bilibili_api import sync, video

        bvid = re.search(r"BV\w+", bili_url).group()
        v = video.Video(bvid=bvid)

        # 1. 获取视频信息
        video_info = sync(v.get_info())
        title = video_info["title"]
        # 计算分段数：每段 6 分钟
        duration = video_info.get("duration", 0)
        seg_count = max(1, math.ceil(duration / 360))

        # 2. 分段获取弹幕
        all_danmaku = []
        for seg_idx in range(seg_count):
            try:
                danmaku_list = sync(v.get_danmakus(from_seg=seg_idx, to_seg=seg_idx))
                all_danmaku.extend(danmaku_list)
            except Exception:
                break

        if not all_danmaku:
            warnings.warn(f"No danmaku found for video: {bili_url}")
            return ""

        # 3. 格式化输出（Danmaku 对象属性：text, dm_time, send_time, mode, color）
        danmaku_lines = [
            f"[{d.dm_time:.1f}s] {d.text} (type={d.mode.value if hasattr(d.mode, 'value') else d.mode}, color={d.color})"
            for d in all_danmaku
        ]
        return f"Video Title: {title}\nDanmaku count: {len(all_danmaku)}\n{''.join(danmaku_lines)}"
****************************************************************************************************
id:  e326c9e0-c5df-497f-9169-a80bb5a99205
def load_data(self, video_urls: List[str], **load_kwargs: Any) -> List[Document]:
        """加载视频弹幕数据。

        Args:
            video_urls (List[str]): List of Bilibili links for which danmaku are to be loaded.

        Returns:
            List[Document]: A list of Document objects, each containing the danmaku for a Bilibili video.
        """
        results = []
        for bili_url in video_urls:
            try:
                danmaku = self.get_bilibili_danmaku(bili_url)
                if danmaku:
                    results.append(Document(text=danmaku))
            except Exception as e:
                warnings.warn(
                    f"Error loading danmaku for video {bili_url}: {e!s}. Skipping video."
                )
        return results
****************************************************************************************************
id:  f7674edc-884e-47d5-b010-863609c8eca8
if __name__ == '__main__':
    # 获取bilibili弹幕读取器
    reader = BilibiliDanmakuReader()
    danmaku_docs = reader.load_data(video_urls=["https://www.bilibili.com/video/BV1GJ411x7h7"])
    for doc in danmaku_docs:
        print(doc.model_dump_json())
****************************************************************************************************
```

