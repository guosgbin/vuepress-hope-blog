---
title: RAG-15-llamaindex 响应生成器
date: 2026-04-28 10:54:23
tags: 
  - RAG
  - AI&LLM
categories:
  - RAG
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年04月28日10:54:28 |

## 响应生成器的定义

### 核心定位

**Synthesizer（响应生成器）**是 RAG 流程中负责将检索上下文转化为最终答案的核心组件。其输入为检索器返回的相关 Node 列表，输出为面向用户的自然语言回复。

### 设计初衷：突破“单次组装生成”的局限

传统做法是将用户问题与检索到的上下文简单拼接，一次性提交给大模型生成。但在实际 RAG 场景中，这种粗放方式存在明显缺陷：

- 上下文信息过载或相互干扰
- 单次推理难以覆盖所有关键信息
- 最终输出质量不稳定，易产生遗漏或幻觉

因此，**单一的生成流程已无法满足高质量回答的需求**。

### 核心机制：多模式策略抽象

为应对复杂场景，Synthesizer 封装了多种响应生成模式。其核心设计思想是**将不同生成策略的执行流程、Prompt 编排与上下文调度进行统一抽象**，对外提供标准化的调用接口。

### 小结

Synthesizer 的本质是**响应生成策略的“抽象工厂”**。它通过屏蔽底层流程的复杂性，让开发者能够根据数据规模、上下文长度与业务要求，灵活切换最匹配的生成模式，从而在 RAG 应用中兼顾回答的**准确性、完整性与推理深度**。

## 响应生成器的构造

构造和配置响应合成器主要有两种路径：**高层 API 自动配置** 和 **底层工厂方法定制**。

### 底层定制：使用 get_response_synthesizer

```python
# 1.构造一个响应生成器
synthesizer = get_response_synthesizer(
    response_mode=ResponseMode.COMPACT,
    streaming=True
)

# 2.在调用 as_query_engine() 方法时，将响应生成器作为参数传入
engine = vector_index.as_query_engine(response_synthesizer=synthesizer)

# 3.直接在构造查询引擎时指定
RetrieverQueryEngine(retriever=retriever, response_synthesizer=synthesizer)
```

### 高层配置：基于 ResponseMode

这是最常见的方式。在构建查询引擎（`as_query_engine()`）时，通过传递 `response_mode` 参数，底层会自动实例化对应的合成器。

```python
query_engine = index.as_query_engine(
    response_mode="refine",  # 指定模式
    verbose=True
)
```

## 响应生成模式

### refine 模式

`refine`（迭代修正）模式是 LlamaIndex 中处理**超长上下文**或**对信息完整度要求极高**场景的核心策略。它打破了大模型“上下文窗口”的限制，采用了一种**“滚雪球”**式的信息处理机制。

以下是对 `refine` 模式的深度分析：

#### 核心逻辑：迭代修正

- **Step 1：初始化（Initial Answer）**：使用第一个检索到的文本块（Node₁）和用户问题（Query），调用大模型生成一个**初始答案（Initial Answer）**。

- **Step 2：迭代细化（Refinement）**：依次读取后续的每一个文本块（Nodeᵢ），将以下内容共同构造为 refine prompt：当前已有答案（existing_answer）、新的文本块（new_node）、原始问题（query）。要求模型基于新信息对已有答案进行：补充（add）、修正（refine）或在信息无关时保持不变（keep unchanged），从而得到更新后的答案。

- **Step 3：循环处理（Iteration）**：重复 Step 2，直到所有检索到的文本块处理完成，最终得到完整答案。

![image-20260428154509148](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428154509148.png)

可以推测，在这种模式下，如果检索器检索出的上下文 Node 数量为 N 个，那么交给响应生成器后，大模型至少需要处理 N 次来完成整个细化过程。 因此，这是一种较为烦琐的且时间较长、token 代价较大的响应生成模式，仅适合需要非常详细的答案时使用。

#### 案例代码

```python
llm = Ollama(model="qwen:0.5b")
Settings.llm= llm

# 构造 refine 响应生成器
response_synthesizer = get_response_synthesizer(response_mode=ResponseMode.REFINE)

# 模拟检索出的 3 个 Node
nodes = [
    NodeWithScore(
        node=TextNode(text="郭大垸是一座历史悠久的水乡古镇，位于我国的中部地区。"
                           "这片土地有着丰富的自然水系和田园风光，总面积约为3000平方公里，常住人口超过50万。"
                           "这里是我国重要的农业、渔业和传统手工业基地之一。"),
        score=1.0, ),
    NodeWithScore(
        node=TextNode(text="郭大的水产养殖业发展迅速，拥有多个现代化渔业示范区，"
                           "吸引了众多科研机构和龙头企业入驻。"
                           "这些企业涵盖了淡水养殖、水产品深加工、冷链物流等多个领域，"
                           "为区域经济注入了强劲动力。"),
        score=1.0, ),
    NodeWithScore(
        node=TextNode(text="郭大垸还拥有多处知名景点，如蜿蜒的江堤、葱郁的防护林、"
                           "古朴的村落和热闹的集镇码头。"
                           "周边还有多个现代农业产业园，出产丰富的莲藕、菱角、鱼虾和特色稻米等农产品，"
                           "在国内外市场上享有盛誉。"),
        score=1.0, ),
]

# 把问题和 Node 交给响应生成器响应生成
resp = response_synthesizer.synthesize(query="郭大垸是什么？", nodes=nodes)
print(resp)
```

*输出*

```
郭大垸是一座位于我国中部地区的水乡古镇，不仅以丰富的自然水系和田园风光著称，还拥有多处知名景点，如蜿蜒的江堤、葱郁的防护林、古朴的村落和热闹的集镇码头。此外，郭大垸及其周边地区发展了现代农业产业园，出产莲藕、菱角、鱼虾及特色稻米等多种优质农产品，在国内外市场上享有盛誉。这里也是重要的农业、渔业基地之一，并且在水产养殖业方面取得了显著成就，吸引了许多科研机构与龙头企业的投资合作，覆盖淡水养殖到冷链物流等多个环节，总面积约3000平方公里，常住人口超过50万，极大地促进了当地经济发展。
```

langfuse 链路:

![image-20260428153626524](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428153626524.png)

#### Prompt 设计的玄机

`refine` 模式的效果很大程度上依赖于它预设的 **Refine Prompt**。LlamaIndex 默认的 Prompt 包含非常巧妙的指令，旨在防止模型“瞎编”或“遗忘”。

**默认的 Refine Prompt 模板核心逻辑：**

首先 system 提示词为：

```
You are an expert Q&A system that is trusted around the world.
Always answer the query using the provided context information, and not prior knowledge.
Some rules to follow:
1. Never directly reference the given context in your answer.
2. Avoid statements like 'Based on the context, ...' or 'The context information ...' or anything along those lines.
```

处理第一个 node 提供给大模型的提示词为：

```
"Context information is below.\n"
"---------------------\n"
"{context_str}\n"
"---------------------\n"
"Given the context information and not prior knowledge, "
"answer the query.\n"
"Query: {query_str}\n"
"Answer: "
```

处理后续的 node 提供给大模型的提示词为：

```
"You are an expert Q&A system that strictly operates in two modes "
"when refining existing answers:\n"
"1. **Rewrite** an original answer using the new context.\n"
"2. **Repeat** the original answer if the new context isn't useful.\n"
"Never reference the original answer or context directly in your answer.\n"
"When in doubt, just repeat the original answer.\n"
"New Context: {context_msg}\n"
"Query: {query_str}\n"
"Original Answer: {existing_answer}\n"
"New Answer: "
```

{existing_answer}这个变量代表了前一次根据 Node 响应生成的答案。另外，对大模型响应生成的指令要求：要么基于新 Node 中的上下文对已有的答案进行重写与补充，要么保留上一次响应生成的答案不变（如果新的上下文没有用） 

### compact 模式

#### 核心逻辑：紧凑打包

Compact（通常对应 CompactAndRefine）是 LlamaIndex 中的一种高效响应生成策略，其核心思想是在上下文窗口限制内，尽可能将多个检索到的文本块（Nodes）进行打包（packing），组成少量批次输入给大模型处理，从而减少调用次数。具体流程是：

1. 先按 token 限制将 Nodes 分组，每组包含尽可能多的文本块；
2. 然后对每一组分别生成局部答案；最后再通过类似 Refine 的迭代方式，将这些局部答案逐步合成为最终答案。

相比 Refine 模式逐个 Node 处理，Compact 能显著降低 LLM 调用次数（从 N 次降到约分组数），同时又比一次性拼接（simple 模式）更稳健，避免上下文超限或信息丢失。其优点是效率与效果较平衡，适合大多数通用问答场景；缺点是在极端长上下文或需要精细推理时，信息利用可能不如纯 Refine 充分。

![image-20260428171820292](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428171820292.png)

#### 案例代码

```python
llm = Ollama(model="qwen:0.5b")
Settings.llm= llm

# 构造 refine 响应生成器
response_synthesizer = get_response_synthesizer(response_mode=ResponseMode.COMPACT)

# 模拟检索出的 3 个 Node
nodes = [
    NodeWithScore(
        node=TextNode(text="郭大垸是一座历史悠久的水乡古镇，位于我国的中部地区。"
                           "这片土地有着丰富的自然水系和田园风光，总面积约为3000平方公里，常住人口超过50万。"
                           "这里是我国重要的农业、渔业和传统手工业基地之一。"),
        score=1.0, ),
    NodeWithScore(
        node=TextNode(text="郭大的水产养殖业发展迅速，拥有多个现代化渔业示范区，"
                           "吸引了众多科研机构和龙头企业入驻。"
                           "这些企业涵盖了淡水养殖、水产品深加工、冷链物流等多个领域，"
                           "为区域经济注入了强劲动力。"),
        score=1.0, ),
    NodeWithScore(
        node=TextNode(text="郭大垸还拥有多处知名景点，如蜿蜒的江堤、葱郁的防护林、"
                           "古朴的村落和热闹的集镇码头。"
                           "周边还有多个现代农业产业园，出产丰富的莲藕、菱角、鱼虾和特色稻米等农产品，"
                           "在国内外市场上享有盛誉。"),
        score=1.0, ),
]

# 把问题和 Node 交给响应生成器响应生成
resp = response_synthesizer.synthesize(query="郭大垸是什么？", nodes=nodes)
print(resp)
```

*输出*

```
郭大坞是位于中国中部的水乡古镇。这里有着丰富的自然水系和田园风光，总面积约为3000平方公里。这里的居民主要来自全国各地的游客，是国内外重要的农业、渔业和传统手工业基地之一。
```

*langfuse 链路*

![image-20260428160313239](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428160313239.png)

### simple_summarize 模式

#### 核心逻辑：全部打包

**一次性把所有上下文拼进一个 Prompt，让 LLM 直接生成答案/摘要**，没有迭代、没有分组、没有 refine。

会对检索出的 Node 中的内容进行合并以适应上下文窗口， 并且将多余的内容截断和忽略， 然后进行一次大模型调用以响应生成。其优点是快速、简单，其缺点是可能会丢失相关的信息。

![image-20260428173057074](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428173057074.png)

#### 案例代码

```python
llm = Ollama(model="qwen:0.5b", context_window=700)
Settings.llm = llm

# 构造 refine 响应生成器
response_synthesizer = get_response_synthesizer(response_mode=ResponseMode.SIMPLE_SUMMARIZE)

# 模拟检索出的 3 个 Node
nodes = [
    NodeWithScore(
        node=TextNode(text="郭大垸是一座历史悠久的水乡古镇，位于我国的中部地区。"
                           "这片土地有着丰富的自然水系和田园风光，总面积约为3000平方公里，常住人口超过50万。"
                           "这里是我国重要的农业、渔业和传统手工业基地之一。"),
        score=1.0, ),
    NodeWithScore(
        node=TextNode(text="郭大的水产养殖业发展迅速，拥有多个现代化渔业示范区，"
                           "吸引了众多科研机构和龙头企业入驻。"
                           "这些企业涵盖了淡水养殖、水产品深加工、冷链物流等多个领域，"
                           "为区域经济注入了强劲动力。"),
        score=1.0, ),
    NodeWithScore(
        node=TextNode(text="郭大垸还拥有多处知名景点，如蜿蜒的江堤、葱郁的防护林、"
                           "古朴的村落和热闹的集镇码头。"
                           "周边还有多个现代农业产业园，出产丰富的莲藕、菱角、鱼虾和特色稻米等农产品，"
                           "在国内外市场上享有盛誉。"),
        score=1.0, ),
]

# 把问题和 Node 交给响应生成器响应生成
resp = response_synthesizer.synthesize(query="郭大垸是什么？", nodes=nodes)
print(resp)
```

*输出*

```
郭大的水产养殖业发展迅速，拥有多个现代化渔业示范区，吸引了众多科研机构和龙头企业入驻。这些企业涵盖了淡水养殖、水产品深加工、冷链物流等多个领域，为区域经济注入了强劲动力。
```

*langfuse链路*：可以看到 Node 被裁剪了，因为上面的代码的 Ollama 的 context_window 设置为 700 了。

![image-20260428194839278](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428194839278.png)

### tree_summarize 模式

#### 核心逻辑：分治 + 递归聚合

`tree_summarize`（树状总结模式）是 LlamaIndex 中处理**海量上下文**或**多文档综合任务**的“重型武器”。它借鉴了分布式计算中的 **MapReduce** 和 **分治算法** 思想，通过自底向上的递归聚合，将碎片化信息逐步收敛为高质量的全局回答。

**步骤一（上下文适配与分组）**
 将检索到的 N 个相关节点按模型最大上下文窗口进行智能合并与分组，确保每组内容的 Token 数量严格控制在模型处理上限之内。

**步骤二（终止条件判断）**
 若分组后仅剩 1 个节点组，则直接将其内容提交给大模型生成最终答案，流程结束。

**步骤三（并行局部汇总）**
 若分组后仍有多个节点组，则并行调用大模型对每组内容独立进行信息提炼，生成多个中间摘要（局部答案）。

**步骤四（递归迭代收敛）**
 将上一步生成的中间摘要重新封装为新的节点列表，再次执行“分组→汇总”流程。循环迭代，直至节点组数量收敛为 1，输出最终结果。

------

💡 **核心逻辑提炼**：该流程本质上是**自底向上的树状归约（Tree Reduction）**。通过“分组打包 → 并行摘要 → 递归上升”的机制，既规避了单次上下文窗口限制，又避免了串行迭代带来的误差累积，特别适合处理海量碎片化文档的综合问答场景。

![image-20260428201312840](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428201312840.png)

#### 案例代码

```python
llm = Ollama(model="qwen:0.5b", context_window=1024)
Settings.llm = llm

# 构造 refine 响应生成器
response_synthesizer = get_response_synthesizer(response_mode=ResponseMode.TREE_SUMMARIZE)

docs = SimpleDirectoryReader(input_files=["../../data/rag.md"]).load_data(show_progress=True)
splitter = SentenceSplitter(chunk_size=512, chunk_overlap=20)
nodes = splitter.get_nodes_from_documents(documents=docs, show_progress=True)
node_scores = [NodeWithScore(node=node, score=1.0) for node in nodes]

# 把问题和 Node 交给响应生成器响应生成
resp = response_synthesizer.synthesize(query="rag是什么？", nodes=node_scores)
print(resp)
```

*输出*

```
rag是可变语言处理中的一个任务，它的主要目标是在模型中进行微调操作，以提高模型性能和精度。rag在不同的语言和应用环境中都有所应用，因此rag的用途是非常广泛的。
```

*langfuse链路*：

![image-20260428201040606](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428201040606.png)

#### Prompt 特点

`tree_summarize` 使用专属的 `tree_summarize_prompt`，其指令结构高度结构化：

```text
"Context information from multiple sources is below.\n"
"---------------------\n"
"{context_str}\n"
"---------------------\n"
"Given the information from multiple sources and not prior knowledge, "
"answer the query.\n"
"Query: {query_str}\n"
"Answer: "
```

**设计精妙之处：**

- **明确多源上下文**：告知模型输入来自多个片段，需交叉验证。
- **强制依赖上下文**：`not prior knowledge` 抑制幻觉。
- **问题始终在场**：每轮递归都注入 `{query_str}`，确保摘要不偏离主题。
- **无历史包袱**：不依赖“上一版答案”，避免了 `refine` 模式的误差累积问题。

### generation 模式

#### 核心逻辑：不携带上下文

这种模式直接调用大模型回答输入问题，不携带任何上下文。

#### 案例代码

```python
llm = Ollama(model="qwen:0.5b", context_window=1024)
Settings.llm = llm

# 构造 refine 响应生成器
response_synthesizer = get_response_synthesizer(response_mode=ResponseMode.GENERATION)

docs = SimpleDirectoryReader(input_files=["../../data/rag.md"]).load_data(show_progress=True)
splitter = SentenceSplitter(chunk_size=512, chunk_overlap=20)
nodes = splitter.get_nodes_from_documents(documents=docs, show_progress=True)
node_scores = [NodeWithScore(node=node, score=1.0) for node in nodes]

# 把问题和 Node 交给响应生成器响应生成
resp = response_synthesizer.synthesize(query="rag是什么？", nodes=node_scores)
print(resp)
```

*输出*

```
rag是日本的动画电影品牌。rag最初由松本润一郎于1964年创立，并逐渐发展成为日本最具影响力的动画电影品牌之一。rag在全球范围内都有着广泛的影响力和忠实的粉丝群体，因此被誉为“亚洲第一”和“世界第二”。rag的动画电影在全球范围内有着广泛的影响和忠实的粉丝群体，因此被誉为“亚洲第一”和“世界第二”。
```

*langfuse链路*：可以看到在调用大模型时候，未携带任何上下文。

![image-20260428202121793](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428202121793.png)

### no_text 模式

#### 核心逻辑

这种模式不会产生真实的大模型响应，仅用于获取检索出的 Node 列表信息。

`no_text` 模式的本质是**“上下文展示器”**。它彻底剥离了 RAG 流程中的 **G (Generation)** 环节，只保留 **R (Retrieval)**。

- **输入**：用户查询 + 索引数据。
- **中间过程**：检索器计算相似度，选出 Top-K 节点。**合成器介入，但发现模式是 `no_text`，于是跳过 Prompt 组装和 LLM 推理**。
- **输出**：将筛选出的节点文本（Text）通过分隔符（如换行符）拼接在一起的纯字符串，不包含任何 AI 生成的润色或总结。

#### 案例代码

```python
llm = Ollama(model="qwen:0.5b", context_window=1024)
embed_model = OllamaEmbedding(model_name="qwen3-embedding:0.6b", embed_batch_size=50)
Settings.embed_model = embed_model
Settings.llm = llm

# 构造 refine 响应生成器
response_synthesizer = get_response_synthesizer(response_mode=ResponseMode.NO_TEXT)

docs = SimpleDirectoryReader(input_files=["../../data/rag.md"]).load_data(show_progress=True)
splitter = SentenceSplitter(chunk_size=512, chunk_overlap=20)

vector_store_index = VectorStoreIndex.from_documents(documents=docs, transformations=[splitter])
query_engine = vector_store_index.as_query_engine(similarity_top_k=1, response_synthesizer=response_synthesizer)

resp = query_engine.query("rag是什么？")
for node in resp.source_nodes:
    print(f"【得分: {node.score}】")
    print(node.text)  # 这里才是检索到的真实文本
    print("-" * 50)
print(resp)
```

*输出*

```
【得分: 0.5317326191154027】
端到端使用门槛极低，无需复杂工程搭建，适合长文档摘要、合同全量审核、整本书籍分析等需要全局逻辑关联的场景； <br>2. 可完整保留文本的上下文链条，避免 RAG 分块导致的语义断裂、跨段落关联信息丢失问题，长文本生成的连贯性更强。 | 1. 存在「Lost in the Middle（中间迷失）」问题：学术与工业界均已验证，模型对长上下文首尾内容的注意力远高于中间段落，超长文本中关键细节的召回率会大幅下降；<br>2. 推理成本与延迟随文本长度指数级上升，海量知识库场景下，全量文本输入完全不具备落地可行性；<br>3. 知识更新不灵活，新增知识要么每次全量输入（成本极高），要么重新微调（周期长、成本高），无法适配实时性要求高的场景。 |
| RAG              | 1. 成本与效率优势显著，仅向模型输入高相关的知识片段，大幅降低 token 消耗与推理延迟，企业级海量知识库场景下唯一具备落地性的方案；<br>2. 知识更新灵活可控，新增、修改知识库内容即可即时生效，完美适配规章制度、产品信息、实时资讯等高频更新的场景；<br/>3.
--------------------------------------------------
None
```

*langfuse 链路*

![image-20260428211052271](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428211052271.png)

### context_only 模式

#### 核心逻辑：零生成

`CONTEXT_ONLY`（仅上下文模式）是 LlamaIndex 中一种**完全剥离大模型生成环节**的策略。它的行为非常简单粗暴：**把检索到的所有文本块直接拼起来，原封不动地返回给你。**

与 `refine`、`compact` 等模式不同，这个模式**绝对不会调用大模型**。

- **输入**：检索器返回的 N 个 Node（文本块）。
- **处理**：系统使用分隔符（通常是换行符 `\n\n`）将这 N 个块的 `text` 属性拼接成一个长字符串。
- **输出**：这个拼接后的长字符串（作为 Response 的文本部分）。

在 LlamaIndex 的实现中，它大概长这样：

```python
def get_response(self, query_str: str, text_chunks: Sequence[str], **kwargs) -> str:
    # 没有任何 LLM 调用，仅仅是把传入的 chunks 拼在一起
    return "\n\n".join(text_chunks)
```

#### 案例代码

```python
llm = Ollama(model="qwen:0.5b", context_window=1024)
embed_model = OllamaEmbedding(model_name="qwen3-embedding:0.6b", embed_batch_size=50)
Settings.embed_model = embed_model
Settings.llm = llm

# 构造 refine 响应生成器
response_synthesizer = get_response_synthesizer(response_mode=ResponseMode.CONTEXT_ONLY)

docs = SimpleDirectoryReader(input_files=["../../data/rag.md"]).load_data(show_progress=True)
splitter = SentenceSplitter(chunk_size=512, chunk_overlap=20)

vector_store_index = VectorStoreIndex.from_documents(documents=docs, transformations=[splitter])
query_engine = vector_store_index.as_query_engine(similarity_top_k=1, response_synthesizer=response_synthesizer)

resp = query_engine.query("rag是什么？")
print(resp)
```

*输出*

```
file_path: ../../data/rag.md

端到端使用门槛极低，无需复杂工程搭建，适合长文档摘要、合同全量审核、整本书籍分析等需要全局逻辑关联的场景； <br>2. 可完整保留文本的上下文链条，避免 RAG 分块导致的语义断裂、跨段落关联信息丢失问题，长文本生成的连贯性更强。 | 1. 存在「Lost in the Middle（中间迷失）」问题：学术与工业界均已验证，模型对长上下文首尾内容的注意力远高于中间段落，超长文本中关键细节的召回率会大幅下降；<br>2. 推理成本与延迟随文本长度指数级上升，海量知识库场景下，全量文本输入完全不具备落地可行性；<br>3. 知识更新不灵活，新增知识要么每次全量输入（成本极高），要么重新微调（周期长、成本高），无法适配实时性要求高的场景。 |
| RAG              | 1. 成本与效率优势显著，仅向模型输入高相关的知识片段，大幅降低 token 消耗与推理延迟，企业级海量知识库场景下唯一具备落地性的方案；<br>2. 知识更新灵活可控，新增、修改知识库内容即可即时生效，完美适配规章制度、产品信息、实时资讯等高频更新的场景；<br/>3.
```

*langfuse 链路*

![image-20260428225529418](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428225529418.png)

### accumulate 模式

#### 核心逻辑：单独请求

`accumulate` 模式将每个检索到的节点（Node）视为一个独立的上下文环境。它**不尝试合并节点**，而是针对**每一个节点**单独向大模型提问，并将答案简单地通过分割符进行组合后直接输出。

#### 案例代码

```python
llm = Ollama(model="qwen:0.5b", context_window=1024)
Settings.llm = llm

# 模拟检索出的 3 个 Node
nodes = [
    NodeWithScore(
        node=TextNode(text="郭大垸是一座历史悠久的水乡古镇，位于我国的中部地区。"
                           "这片土地有着丰富的自然水系和田园风光，总面积约为3000平方公里，常住人口超过50万。"
                           "这里是我国重要的农业、渔业和传统手工业基地之一。"),
        score=1.0, ),
    NodeWithScore(
        node=TextNode(text="郭大的水产养殖业发展迅速，拥有多个现代化渔业示范区，"
                           "吸引了众多科研机构和龙头企业入驻。"
                           "这些企业涵盖了淡水养殖、水产品深加工、冷链物流等多个领域，"
                           "为区域经济注入了强劲动力。"),
        score=1.0, ),
    NodeWithScore(
        node=TextNode(text="郭大垸还拥有多处知名景点，如蜿蜒的江堤、葱郁的防护林、"
                           "古朴的村落和热闹的集镇码头。"
                           "周边还有多个现代农业产业园，出产丰富的莲藕、菱角、鱼虾和特色稻米等农产品，"
                           "在国内外市场上享有盛誉。"),
        score=1.0, ),
]

# 构造 refine 响应生成器
response_synthesizer = get_response_synthesizer(response_mode=ResponseMode.ACCUMULATE)
# 把问题和 Node 交给响应生成器响应生成
resp = response_synthesizer.synthesize(query="郭大垸是什么？", nodes=nodes)
print(resp)
```

*输出*

```
Response 1:  郭大阱是位于中国中部地区的水乡古镇。
---------------------
Response 2: 郭大的水产养殖业发展迅速，拥有多个现代化渔业示范区。这些企业涵盖了淡水养殖、水产品深加工、冷链物流等多个领域，为区域经济注入了强劲动力。
---------------------
Response 3:  郭大跑道是郭大口径的简称，指的就是1968年7月5日以后建设起来的铁路线路。这条铁路线从上海出发，一直往北京方向，全长约243公里。这条铁路线不仅连接了上海和北京两座重要的城市中心，而且也是中国改革开放的重要载体之一。
```

*langfuse 链路*：可以看到，对输入的 3 个 Node 分别调用了大模型获得响应，而最后的结果就是把 3 个答案直接连接起来输出（默认使用横线分割） 。

![image-20260428211544582](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428211544582.png)

### compact_accumulate 模式

#### 核心逻辑：分组 + 并行 (Batch & Accumulate)

它解决了 `accumulate` 模式（一次只看一个切片）太慢、太碎的问题，也避免了 `compact` 模式（一次看所有内容）容易丢失细节或超出的风险。

1. **Compact（分组）**：系统会计算上下文窗口，尽可能将多个检索到的节点（Nodes）**合并**成一组（Group），直到填满窗口。
2. **Accumulate（独立生成）**：针对**每一组**内容，独立调用 LLM 生成一个回答。各组之间互不干扰。
3. **拼接**：将所有组的回答按顺序拼在一起，作为最终结果。

#### 案例代码

```python
llm = Ollama(model="qwen:0.5b", context_window=1024)
Settings.llm = llm

# 模拟检索出的 3 个 Node
nodes = [
    NodeWithScore(
        node=TextNode(text="郭大垸是一座历史悠久的水乡古镇，位于我国的中部地区。"
                           "这片土地有着丰富的自然水系和田园风光，总面积约为3000平方公里，常住人口超过50万。"
                           "这里是我国重要的农业、渔业和传统手工业基地之一。"),
        score=1.0, ),
    NodeWithScore(
        node=TextNode(text="郭大的水产养殖业发展迅速，拥有多个现代化渔业示范区，"
                           "吸引了众多科研机构和龙头企业入驻。"
                           "这些企业涵盖了淡水养殖、水产品深加工、冷链物流等多个领域，"
                           "为区域经济注入了强劲动力。"),
        score=1.0, ),
    NodeWithScore(
        node=TextNode(text="郭大垸还拥有多处知名景点，如蜿蜒的江堤、葱郁的防护林、"
                           "古朴的村落和热闹的集镇码头。"
                           "周边还有多个现代农业产业园，出产丰富的莲藕、菱角、鱼虾和特色稻米等农产品，"
                           "在国内外市场上享有盛誉。"),
        score=1.0, ),
]

# 构造 refine 响应生成器
response_synthesizer = get_response_synthesizer(response_mode=ResponseMode.COMPACT_ACCUMULATE)
# 把问题和 Node 交给响应生成器响应生成
resp = response_synthesizer.synthesize(query="郭大垸是什么？", nodes=nodes)
print(resp)
```

*输出*

```
Response 1: 郭大的水产养殖业发展迅速，拥有多个现代化渔业示范区，吸引了众多科研机构和龙头企业入驻。这些企业涵盖了淡水养殖、水产品深加工、冷链物流等多个领域，为区域经济注入了强劲动力。
```

*langfuse 链路*：此时，只剩下了一次大模型调用，最终响应生成的结果只有这次调用的输出。原因是这里的多个 Node 中的内容被合并后调用大模型，减少了大模型调用次数。

![image-20260428224001875](./15-llamaindex%20%E5%93%8D%E5%BA%94%E7%94%9F%E6%88%90%E5%99%A8_img/image-20260428224001875.png)

## 响应生成器的参数

函数签名核心部分：

```python
def get_response_synthesizer(
    llm=None,
    prompt_helper=None,
    text_qa_template=None,
    refine_template=None,
    summary_template=None,
    simple_template=None,
    response_mode=ResponseMode.COMPACT,
    callback_manager=None,
    use_async=False,
    streaming=False,
    structured_answer_filtering=False,
    output_cls=None,
    program_factory=None,
    verbose=False,
)
```

*参数总表*

| 参数名                        | 作用                                              | 主要影响哪些模式                                             |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| `llm`                         | 指定用于响应生成的大模型实例                      | 除 `NO_TEXT` / `CONTEXT_ONLY` 外几乎全部                     |
| `prompt_helper`               | 控制上下文窗口计算、截断、重组（repack/truncate） | 全部与上下文相关的模式                                       |
| `text_qa_template`            | 标准问答 Prompt 模板                              | `REFINE`、`COMPACT`、`SIMPLE_SUMMARIZE`、`ACCUMULATE`、`COMPACT_ACCUMULATE` |
| `refine_template`             | 迭代修正 Prompt 模板                              | `REFINE`、`COMPACT`                                          |
| `summary_template`            | 树状摘要 Prompt 模板                              | `TREE_SUMMARIZE`                                             |
| `simple_template`             | 纯生成 Prompt 模板                                | `GENERATION`                                                 |
| `response_mode`               | 选择响应生成模式                                  | 所有模式入口                                                 |
| `callback_manager`            | 回调/观测/日志埋点                                | 全部                                                         |
| `use_async`                   | 是否异步执行并行任务                              | `TREE_SUMMARIZE`、`ACCUMULATE`、`COMPACT_ACCUMULATE`         |
| `streaming`                   | 是否启用流式输出                                  | 大多数模式支持，少数不支持                                   |
| `structured_answer_filtering` | 是否启用结构化“答案有效性过滤”                    | `REFINE` / `COMPACT`                                         |
| `output_cls`                  | 指定结构化输出模型（Pydantic）                    | 多个模式可用                                                 |
| `program_factory`             | 自定义结构化程序工厂                              | `REFINE` / `COMPACT`                                         |
| `verbose`                     | 是否打印中间过程                                  | `REFINE`、`COMPACT`、`TREE_SUMMARIZE`                        |

------

### 这些公共参数到底怎么理解

**1） `llm`**

这是响应生成器真正调用的大模型。如果你不传，工厂函数会回退到：

```python
llm = llm or Settings.llm
```

所以很多时候你感觉“没传也能跑”，本质上是用了全局 `Settings.llm`。

---

**2）`prompt_helper`**

这个参数非常关键，但容易被忽略。它不是 Prompt 模板本身，而是**上下文窗口管理器**，负责：

- 计算当前 Prompt 占用多少 token
- 还剩多少 token 能放上下文
- 文本过长时如何 `truncate`
- 文本过多时如何 `repack`

它直接决定：

- `compact` 怎么“打包”
- `simple_summarize` 怎么“截断”
- `tree_summarize` 怎么“分组”

如果你遇到：

- `Calculated available context size -329 was not non-negative`
- 回答被截断
- 模式自动切块

本质上都和 `prompt_helper` 有关。

---

**3）四类 Prompt 模板参数**

- `text_qa_template`：最常用模板，表示“给定上下文，回答问题”的主 Prompt。影响所有基于上下文直接问答的模式。

- `refine_template`：只在迭代修正类模式中生效。它决定模型看到“旧答案 + 新上下文”时怎么修改答案。

- `summary_template`：只用于`tree_summarize`。它的任务不是回答问题，而是“对这一组上下文做局部总结”。

- `simple_template`：只用于 `generation`。因为 `generation` 模式根本不看检索上下文，只拿用户问题直接生成。

------

**4）`response_mode`**

这是模式总开关。源码里分派关系如下：

| ResponseMode         | 实际类                 |
| -------------------- | ---------------------- |
| `REFINE`             | `Refine`               |
| `COMPACT`            | `CompactAndRefine`     |
| `TREE_SUMMARIZE`     | `TreeSummarize`        |
| `SIMPLE_SUMMARIZE`   | `SimpleSummarize`      |
| `GENERATION`         | `Generation`           |
| `ACCUMULATE`         | `Accumulate`           |
| `COMPACT_ACCUMULATE` | `CompactAndAccumulate` |
| `NO_TEXT`            | `NoText`               |
| `CONTEXT_ONLY`       | `ContextOnly`          |

所以“分析参数”时，本质上就是在分析这些类的构造参数。

------

**5） `use_async`**

这个参数并不是所有模式都用。

实际生效的模式：

- `TREE_SUMMARIZE`
- `ACCUMULATE`
- `COMPACT_ACCUMULATE`

不生效或不重要的模式：

- `REFINE`
- `COMPACT`
- `SIMPLE_SUMMARIZE`
- `GENERATION`
- `NO_TEXT`
- `CONTEXT_ONLY`

也就是说，`use_async=True` 主要控制**可并行的批量模式**，例如：

- 多组摘要并行生成
- 多块上下文并行回答

------

**6） `streaming`**

这个参数表示是否要流式输出。但不是每种模式都支持：

| 模式                 | 是否支持 streaming                        |
| -------------------- | ----------------------------------------- |
| `REFINE`             | 支持（但和 structured filtering 冲突）    |
| `COMPACT`            | 支持                                      |
| `TREE_SUMMARIZE`     | 支持                                      |
| `SIMPLE_SUMMARIZE`   | 支持                                      |
| `GENERATION`         | 支持                                      |
| `ACCUMULATE`         | **不支持**，源码直接报错                  |
| `COMPACT_ACCUMULATE` | 继承 `Accumulate`，因此本质上也不适合流式 |
| `NO_TEXT`            | 没意义                                    |
| `CONTEXT_ONLY`       | 没意义                                    |

`Accumulate` 源码里写得很明确：

```python
if self._streaming:
    raise ValueError("Unable to stream in Accumulate response mode")
```

------

**7） `structured_answer_filtering`**

这个参数只对 `Refine` / `Compact` 特别有意义。

作用：让模型在每一轮修正时，不只是输出一个字符串答案，还输出一个结构化结果：

```python
class StructuredRefineResponse(BaseModel):
    answer: str
    query_satisfied: bool
```

也就是说，模型不仅回答，还要判断：当前上下文是否已经足够回答问题？这能避免“无关上下文也强行改答案”的问题。

但它有两个限制：

1. **不能和 `streaming=True` 同时使用**
2. 如果你不开启它，就不能传 `program_factory`

源码里直接限制了：

```python
if self._streaming and self._structured_answer_filtering:
    raise ValueError(...)
```

------

**8） `output_cls`**

这个参数表示：你希望模型输出的是某种**结构化对象**，而不是普通字符串。

比如：

```python
class QAResult(BaseModel):
    answer: str
    confidence: float
```

传入后，某些模式会自动调用：

- `structured_predict`
- `astructured_predict`

而不是普通的 `predict`，这意味着输出不再只是文本，而可能是一个 Pydantic 对象。

------

**9）`program_factory`**

这个参数是给 `Refine` / `Compact` 的高级扩展点。它允许你接管“结构化回答程序”的构造方式。一般情况下你用不到，除非你要深度定制：

- 结构化回答校验逻辑
- 特定 LLM 的 structured output 实现
- 自定义 program runner

------

**10）`verbose`**

这个参数用于打印中间过程，主要帮助调试。比如在 `TreeSummarize` 中，它会打印：

```python
print(f"{len(text_chunks)} text chunks after repacking")
```

所以当你想分析：

- compact 后还剩几块
- tree_summarize 每轮分成几组

就很有用。

## 实现自定义的响应生成器

在 LlamaIndex 中，响应生成器的本质是：**把检索出来的 `NodeWithScore` 列表，按照某种策略组织成上下文，再决定是否调用 LLM、如何调用 LLM，最终生成 `Response` 对象。**

自定义的响应生成器需要派生自 BaseSynthesizer，并实现其必要的接口。

### BaseSynthesizer 的地位

```python
class BaseSynthesizer(PromptMixin, DispatcherSpanMixin):
```

它是所有响应生成器的统一抽象，负责：

- 管理 `llm`
- 管理 `prompt_helper`
- 管理 `callback_manager`
- 统一封装 `synthesize()` / `asynthesize()`
- 把 `NodeWithScore` 转换成最终 `Response`

换句话说：自定义模式时，**不需要自己写完整的 synthesize 框架**，只需要实现“核心生成逻辑”。

### 你必须实现的两个抽象方法

```python
@abstractmethod
def get_response(
    self,
    query_str: str,
    text_chunks: Sequence[str],
    **response_kwargs: Any,
) -> RESPONSE_TEXT_TYPE:
    ...
```

```python
@abstractmethod
async def aget_response(
    self,
    query_str: str,
    text_chunks: Sequence[str],
    **response_kwargs: Any,
) -> RESPONSE_TEXT_TYPE:
    ...
```

也就是说：你真正要自定义的只有两件事：

1. **同步版**：`get_response`
2. **异步版**：`aget_response`

它们接收的输入不是 `NodeWithScore`，而是已经抽取好的：

- `query_str`
- `text_chunks: Sequence[str]`

所以你关注的是：**“给我问题 + 一组文本块，我要怎么生成回答？”**

### 案例

```python
from llama_index.core.prompts import PromptTemplate

class MyPromptSynthesizer(BaseSynthesizer):
    def __init__(self, qa_template=None, **kwargs):
        super().__init__(**kwargs)
        self._qa_template = qa_template or PromptTemplate(
            "请根据上下文回答问题。\n上下文：{context_str}\n问题：{query_str}"
        )

    def _get_prompts(self):
        return {"qa_template": self._qa_template}

    def _update_prompts(self, prompts):
        if "qa_template" in prompts:
            self._qa_template = prompts["qa_template"]

    def get_response(self, query_str, text_chunks, **response_kwargs):
        context = "\n\n".join(text_chunks)
        return self._llm.predict(
            self._qa_template,
            context_str=context,
            query_str=query_str,
            **response_kwargs,
        )

    async def aget_response(self, query_str, text_chunks, **response_kwargs):
        context = "\n\n".join(text_chunks)
        return await self._llm.apredict(
            self._qa_template,
            context_str=context,
            query_str=query_str,
            **response_kwargs,
        )
```

### 自定义响应生成器应用场景

以下场景非常适合自定义：

1. **业务有固定回答结构**

比如你要求输出：

- 摘要
- 风险点
- 建议
- 引用来源

而不是普通自然语言段落。

------

2. **上下文进入模型前需要特殊预处理**

比如：

- 按时间排序
- 按来源去重
- 按主题聚类
- 过滤低质量 chunk
- 保留高置信 metadata

------

3. **你不想用默认 Prompt**

比如默认 Prompt 太通用，你要改成：

- 中文学术风格
- 法律问答风格
- 医疗保守回答风格
- 企业客服话术风格

------

**4. 你需要“混合生成策略”**

例如：

- 先对每组做 accumulate
- 再对 group summary 做 refine
- 或者“标题 chunk 用 tree，总结 chunk 用 compact”

这类组合策略，内置模式一般不直接提供。
