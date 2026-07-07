---
title: RAG-17-llamaindex RAG引擎-对话引擎
date: 2026-05-06 15:47:45
tags: 
  - RAG
  - AI&LLM
categories:
  - RAG
---

| 版本 | 内容 | 时间                |
| ---- | ---- | ------------------- |
| V1   | 新建 | 2026-05-06 15:47:48 |

从 **定位、核心抽象、主要模式、执行流程、记忆机制、与 Query Engine 的关系、源码结构** 七个层面，系统分析 **LlamaIndex 的对话引擎（Chat Engine）**。

## 什么是对话引擎

查询引擎的应用可划分为两类典型场景：其一为**单轮独立问答**，每次面向数据与知识库发起独立查询并生成应答，不依赖历史对话上下文；其二为**多轮连续交互**，用户需通过多轮问答逐步完成需求诉求，常见于产品咨询、业务答疑等连续会话场景。

该类多轮场景需依托**历史对话上下文**，实现对当前用户意图的精准理解与应答生成。由于大模型原生具备**无状态特性**，无法自主留存会话记忆，多轮对话只能通过在请求中携带历史会话记录实现上下文延续。

在 RAG 系统中构建**上下文感知型多轮检索对话**，主要存在三方面核心难点：

1. 会话管理：实现历史对话记录的透明化存储、加载与请求链路携带；
2. 语义检索：基于对话上下文进行意图理解，完成关联知识的精准召回；
3. 应答生成：结合检索召回的领域知识，设计适配的生成策略输出符合上下文逻辑的应答。

对话引擎（Chat Engine）可视为查询引擎的**有状态扩展形态**，多数对话引擎均以基础查询引擎为核心进行封装与构建。



简单来说：

- **Query Engine** 解决的是“一次性问答”
- 那么 **Chat Engine** 解决的是“**多轮连续对话**”

也就是说，Chat Engine 不是简单地调用 `query_engine.query()` 多次，而是在 RAG 基础上增加了：

1. **会话记忆（Memory）**
2. **多轮上下文改写**
3. **对话态 prompt 组织**
4. **流式聊天输出**
5. **聊天历史持久化**

## 对话引擎的创建

### 高级 API

```python
# 用向量索引构造查询引擎
chat_engine = vector_index.as_chat_engine(streaming=True)
response = chat_engine.stream_chat('向量数据库是什么')
response.print_response_stream()
```

与查询引擎不一样的是，由于对话引擎支持带有上下文的连续对话，即存在会话（Session）的概念，因此需要有一种方法能够重新开始新的会话。可以使用 reset 接口来复位：

```python
chat_engine.reset()
```

对话引擎提供了简单的方法可以进入连续多轮的交互式对话：

```python
chat_engine.chat_repl()
```

### 底层 API 创建

如果需要更精确地控制对话引擎的构造，就要使用底层 API 组合构造。不同模式的对话引擎则是直接通过构造不同类型的对话引擎组件完成的。查询引擎所依赖的底层组件是检索器与响应生成器，而对话引擎则通常需要在查询引擎的基础上增加记忆等能力而构造。

下面构造的是一种叫 condense_question 模式的对话引擎 TODO-KWOK

```python
custom_prompt = PromptTemplate(
    """\
    请根据以下的历史对话记录和新的输入问题，重写一个新的问题，使其能够捕捉对话中的
    所有相关上下文。
    <Chat History>
    {chat_history}
    <Follow Up Message>
    {question}
    <Standalone question>
    """
)
# 历史对话记录
custom_chat_history = [
    ChatMessage(
        role=MessageRole.USER,
        content="我们来讨论 AI 对程序员的冲击吧",
    ),
    ChatMessage(role=MessageRole.ASSISTANT, content="好的"),
]

# 构造几个模拟的 Document 对象
documents = [
    Document(
        text="AI让好多程序员失业了",
        metadata={"category": "AI", "topic": "AI"},
    )
]

llm = Ollama(model='qwen:0.5b')
embed_model = OllamaEmbedding(model_name="qwen3-embedding:0.6b", embed_batch_size=50)
Settings.embed_model = embed_model
Settings.llm = llm

splitter = SentenceSplitter(chunk_size=100, chunk_overlap=10)
nodes = splitter.get_nodes_from_documents(documents=documents, show_progress=True)
# 显式生成向量并绑定到节点
embeddings = embed_model.get_text_embedding_batch(
    [node.get_content(metadata_mode=MetadataMode.EMBED) for node in nodes],
    show_progress=True,
)
for node, embedding in zip(nodes, embeddings):
    node.embedding = embedding

vector_index = VectorStoreIndex(nodes=nodes)

# 先构造查询引擎
query_engine = vector_index.as_query_engine()
# 再构造对话引擎
chat_engine = CondenseQuestionChatEngine.from_defaults(
    query_engine=query_engine,  # 对话引擎基于查询引擎构造
    condense_question_prompt=custom_prompt,  # 设置重写问题的Prompt模板
    chat_history=custom_chat_history,  # 携带历史对话记录
    verbose=True,
)
chat_engine.chat_repl()
```

## 核心抽象：BaseChatEngine

基类定义：

```python
class BaseChatEngine(DispatcherSpanMixin, ABC):
```

它统一约束了所有对话引擎的接口：

| 方法             | 作用             |
| ---------------- | ---------------- |
| `chat()`         | 同步对话         |
| `stream_chat()`  | 同步流式对话     |
| `achat()`        | 异步对话         |
| `astream_chat()` | 异步流式对话     |
| `reset()`        | 清空会话状态     |
| `chat_history`   | 获取当前聊天历史 |

这意味着：所有具体对话引擎，无论内部策略多复杂，对外暴露的都是统一的“聊天接口”。

## Chat Engine 返回值是什么

与 Query Engine 不同，Chat Engine 返回的不是普通 `Response`，而是：

### 普通模式：`AgentChatResponse`

```python
@dataclass
class AgentChatResponse:
    response: str
    sources: List[ToolOutput]
    source_nodes: List[NodeWithScore]
    is_dummy_stream: bool = False
    metadata: Optional[Dict[str, Any]] = None
```

字段含义

| 字段           | 说明                                                    |
| -------------- | ------------------------------------------------------- |
| `response`     | 最终给用户展示的聊天回复                                |
| `sources`      | 本轮对话中使用到的工具输出（例如 retriever 的检索结果） |
| `source_nodes` | 实际命中的知识节点                                      |
| `metadata`     | 额外信息                                                |

### 流式模式：`StreamingAgentChatResponse`

它支持：

- token 级增量输出
- 边输出边写入 memory
- 队列 / 线程 / async task 管理流式写历史

这说明 Chat Engine 相比 Query Engine 多了一层很重要的能力：**它不仅负责回答，还负责把回答安全地“写回对话历史”**

## 理解不同的对话模式

| 对话模式标识          | 引擎类型                      | 依赖主要组件     | 引擎说明                                                     |
| :-------------------- | :---------------------------- | :--------------- | :----------------------------------------------------------- |
| simple                | SimpleChatEngine              | LLM              | 基础极简对话引擎，仅依托大语言模型实现问答生成，无知识检索与问题优化能力，适用于通用单轮对话场景。 |
| condense_question     | CondenseQuestionChatEngine    | QueryEngine、LLM | 可基于历史对话精简与凝练用户问题，结合查询引擎完成知识查询，适配简单多轮知识问答场景。 |
| context               | ContextChatEngine             | Retriever、LLM   | 依托检索器获取外部知识库信息，结合对话上下文与大模型生成应答，实现上下文感知的知识对话。 |
| condense_plus_context | CondensePlusContextChatEngine | Retriever、LLM   | 融合问题凝练与上下文检索能力，优化用户查询语义，精准匹配知识库内容，提升多轮问答准确性。 |

### SIMPLE：纯聊天模式

**对应类**：SimpleChatEngine

**核心逻辑**：不使用知识库、不做检索，只把：system prompt、历史消息、当前用户输入拼成对话消息列表，直接发给 LLM

**工作流程**：

![image-20260506171757359](./17-llamaindex%20RAG%E5%BC%95%E6%93%8E-%E5%AF%B9%E8%AF%9D%E5%BC%95%E6%93%8E_img/image-20260506171757359.png)

**案例代码**：

```python
llm = Ollama(model='qwen:0.5b')
Settings.llm = llm

# 构造对话引擎
chat_engine = SimpleChatEngine.from_defaults(
    verbose=True,
)
chat_engine.chat_repl()
```

**Langfuse 监控**：可以看到每次和大模型对话时，会带上之前的聊天记录。

![image-20260506173504062](./17-llamaindex%20RAG%E5%BC%95%E6%93%8E-%E5%AF%B9%E8%AF%9D%E5%BC%95%E6%93%8E_img/image-20260506173504062.png)



**适用场景**

- 普通聊天
- 纯 LLM 助手
- 不依赖外部知识库的对话

### CONDENSE_QUESTION：先改写问题，再查询

**对应类**：CondenseQuestionChatEngine

**核心逻辑**：这个模式的**核心工作流程只有两步**：

- **1）先把 “带上下文的问题” 压缩成 “独立问题”**
  - 比如：
    - 历史对话：`用户问：苹果手机多少钱？`
    - 当前问题：`它的内存多大？`

​	👉 模型会自动把当前问题**重写**成：苹果手机的内存多大？

​	这个过程就叫 **condense question（凝练问题）**。

- **2）再把这个独立问题丢给检索引擎去查知识库**
  - 因为**检索引擎不理解历史对话**，所以必须先把问题变成完整、独立、不需要上下文也能看懂的句子，才能去检索知识。

总结一下就是：**CondenseQuestion 模式先基于对话历史将当前问题凝练为独立查询语句，再通过查询引擎检索知识并生成回答，实现无状态检索与有状态对话的结合。**

**工作流程图**：

![image-20260506194606871](./17-llamaindex%20RAG%E5%BC%95%E6%93%8E-%E5%AF%B9%E8%AF%9D%E5%BC%95%E6%93%8E_img/image-20260506194606871.png)

**案例代码**

```python
# 使用 LlamaIndexInstrumentor 进行 Langfuse 埋点
instrumentor = LlamaIndexInstrumentor(
    public_key="pk-lf-ca7fe48a-a3e4-4b4c-bd59-dd31efa113fa",
    secret_key="sk-lf-503a955d-be84-41eb-ae6f-69b7b2f420b2",
    host="http://localhost:3000",
)
instrumentor.start()

llm = DashScope(
    model="qwen3.5-plus",  # 或 qwen-plus, qwen-turbo, qwen-max-longcontext
    temperature=0.7,
    max_tokens=2048,
    api_key="sk-c40def36e714421da0a8a9d9b74dfebb"
)
# llm = Ollama(model='qwen:0.5b')
embed_model = OllamaEmbedding(model_name="qwen3-embedding:0.6b", embed_batch_size=50)
Settings.embed_model = embed_model
Settings.llm = llm

reader = SimpleDirectoryReader(input_files=["../../data/rag.md"])
documents = reader.load_data(show_progress=True)

splitter = SentenceSplitter(chunk_size=100, chunk_overlap=10)
nodes = splitter.get_nodes_from_documents(documents=documents, show_progress=True)
# 显式生成向量并绑定到节点
embeddings = embed_model.get_text_embedding_batch(
    [node.get_content(metadata_mode=MetadataMode.EMBED) for node in nodes],
    show_progress=True,
)
for node, embedding in zip(nodes, embeddings):
    node.embedding = embedding

vector_index = VectorStoreIndex(nodes=nodes)

# 用向量索引构造查询引擎
chat_engine = CondenseQuestionChatEngine.from_defaults(
    query_engine=vector_index.as_query_engine(),  # 对话引擎基于查询引擎构造
    verbose=True,
)

chat_engine.chat_repl()
```

**langfuse链路**：可以看出，这一次大模型调用是为了重写当前输入的问题，让语义更加独立与完整。

![image-20260506194140063](./17-llamaindex%20RAG%E5%BC%95%E6%93%8E-%E5%AF%B9%E8%AF%9D%E5%BC%95%E6%93%8E_img/image-20260506194140063.png)

**优缺点**

condense_question 模式的最大优点是在每次检索上下文之前都会根据历史记忆来完善本次输入的问题的语义，这样大大提高了召回知识的相关性。因为在连续对话的场景中，单个问题很可能无法包含完整的语义。因此，这种模式非常适合 RAG 应用场景中的连续对话。

其缺点是会增加大模型调用次数，不仅是因为需要重写输入的问题，采用复杂响应生成模式的查询引擎还可能带来更多的大模型调用。

**适用场景**

- 用户经常追问“它/这个/那种方式”
- 你希望沿用现有 Query Engine，不改检索链路

------

### CONTEXT：直接检索，再聊天

**对应类**：ContextChatEngine

**核心逻辑**：

1. 直接用当前用户问题做检索
2. 把检索到的上下文塞进 system prompt
3. 再带着聊天历史一起让 LLM 回答

也就是说，它不做问题改写，而是：**当前问题直接查知识库 + 会话历史一起参与回答**

**工作流程**

![image-20260506202157342](./17-llamaindex%20RAG%E5%BC%95%E6%93%8E-%E5%AF%B9%E8%AF%9D%E5%BC%95%E6%93%8E_img/image-20260506202157342.png)

**案例代码**

```python
llm = Ollama(model='qwen:0.5b')
embed_model = OllamaEmbedding(model_name="qwen3-embedding:0.6b", embed_batch_size=50)
Settings.embed_model = embed_model
Settings.llm = llm

reader = SimpleDirectoryReader(input_files=["../../data/rag.md"])
documents = reader.load_data(show_progress=True)

splitter = SentenceSplitter(chunk_size=100, chunk_overlap=10)
nodes = splitter.get_nodes_from_documents(documents=documents, show_progress=True)
# 显式生成向量并绑定到节点
embeddings = embed_model.get_text_embedding_batch(
    [node.get_content(metadata_mode=MetadataMode.EMBED) for node in nodes],
    show_progress=True,
)
for node, embedding in zip(nodes, embeddings):
    node.embedding = embedding

vector_index = VectorStoreIndex(nodes=nodes)

# 用向量索引构造查询引擎
chat_engine = vector_index.as_chat_engine(chat_mode=ChatMode.CONTEXT)
chat_engine.chat_repl()
```

**langfuse 链路图**

![image-20260507192702267](./17-llamaindex%20RAG%E5%BC%95%E6%93%8E-%E5%AF%B9%E8%AF%9D%E5%BC%95%E6%93%8E_img/image-20260507192702267.png)

**核心特点**

- 检索是直接基于当前输入
- 上下文被嵌入到 System Prompt 里
- 用的是 `CompactAndRefine` 类型的响应生成器

**适用场景**

- 每轮问题都比较独立
- 希望每轮都重新从知识库拿上下文
- 对“问题改写”不敏感

### CONDENSE_PLUS_CONTEXT：先改写，再检索，再回答

**对应类**：CondensePlusContextChatEngine

**核心逻辑**：它把前两个模式组合起来：

1. **Condense**：把聊天历史 + 当前消息改写成独立问题
2. **Retrieve**：用改写后的问题检索上下文
3. **Context-based Answering**：把上下文和问题一起交给响应生成器
4. **Memory**：把最终结果写回聊天历史

所以它本质上是一个 **C3 pipeline**：

> **Condense → Context → Completion**

源码里甚至把这个内部流程封装成：

```python
_run_c3()
_arun_c3()
```

**执行流程**：

![image-20260507200012805](./17-llamaindex%20RAG%E5%BC%95%E6%93%8E-%E5%AF%B9%E8%AF%9D%E5%BC%95%E6%93%8E_img/image-20260507200012805.png)

**案例代码：**

```python
llm = Ollama(model='qwen:0.5b')
embed_model = OllamaEmbedding(model_name="qwen3-embedding:0.6b", embed_batch_size=50)
Settings.embed_model = embed_model
Settings.llm = llm

reader = SimpleDirectoryReader(input_files=["../../data/rag.md"])
documents = reader.load_data(show_progress=True)

splitter = SentenceSplitter(chunk_size=100, chunk_overlap=10)
nodes = splitter.get_nodes_from_documents(documents=documents, show_progress=True)
# 显式生成向量并绑定到节点
embeddings = embed_model.get_text_embedding_batch(
    [node.get_content(metadata_mode=MetadataMode.EMBED) for node in nodes],
    show_progress=True,
)
for node, embedding in zip(nodes, embeddings):
    node.embedding = embedding

vector_index = VectorStoreIndex(nodes=nodes)

# 用向量索引构造查询引擎
chat_engine = CondensePlusContextChatEngine.from_defaults(
    retriever=vector_index.as_retriever(similarity_top_k=1),  # 对话引擎基于查询引擎构造
)

chat_engine.chat_repl()
```

**langfuse链路图**

![image-20260507195834812](./17-llamaindex%20RAG%E5%BC%95%E6%93%8E-%E5%AF%B9%E8%AF%9D%E5%BC%95%E6%93%8E_img/image-20260507195834812.png)



**优缺点**

condense_plus_context 对话模式最大的特点是结合了上述两种模式的优点，即通过重写当前的输入问题来提高本次上下文召回的精确性，同时简化了响应生成的过程，没有采用复杂的查询引擎来响应生成。当然，这丧失了在响应生成模式上的灵活性。

**适用场景**

- 企业知识库问答
- 多轮追问型客服系统
- 复杂上下文依赖场景

### 其他模式

除了了上面的几种模式，还有 REACT、OPENAI、BEST 模式，定义在 llama_index.core.chat_engine.types.ChatMode 枚举中，

- 其中 REACT、OPENAI 模式已经被标记 `NOTE: Deprecated and unsupported.`，因为它本质上已经不属于“Chat Engine”范畴，而更属于“Agent Workflow”范畴。如果想使用请参考 llama_index.core.agent.workflow 包。
- BEST 模式本质上就是 CONDENSE_PLUS_CONTEXT 模式的别名，内部实现逻辑是一样的。

### 对话引擎的各种模式小节

![image-20260507205444556](./17-llamaindex%20RAG%E5%BC%95%E6%93%8E-%E5%AF%B9%E8%AF%9D%E5%BC%95%E6%93%8E_img/image-20260507205444556.png)

## 记忆（Memory）机制是 Chat Engine 的核心增强

Query Engine 没有会话记忆，而 Chat Engine 的本质差异就在于：**它会显式维护 `chat_history`**

在代码中可以看到构造 Memory 时会有限制，说明 memory 不会无限保存并无限喂给模型，而是会根据模型的上下文窗口做裁剪。其中下面的 0.75 用于预留空间，提供给：

- 系统提示词
- 当前用户输入
- 模型输出缓冲

所以 memory 是**有容量管理能力的短期会话记忆**。

```python
DEFAULT_TOKEN_LIMIT_RATIO = 0.75
DEFAULT_TOKEN_LIMIT = 3000

if llm is not None:
    context_window = llm.metadata.context_window
    token_limit = token_limit or int(context_window * DEFAULT_TOKEN_LIMIT_RATIO)
elif token_limit is None:
    token_limit = DEFAULT_TOKEN_LIMIT
```

这说明：

- Memory 默认是有 token 限额的
- 会自动裁剪历史消息，避免超过上下文窗口

**为什么要这样设计？**因为在真实聊天里：

- 历史消息越来越多
- 检索上下文也要占窗口
- 当前用户问题也要占窗口
- 模型还要预留输出空间

如果 memory 不裁剪，就会频繁触发：

- 上下文超长
- token overflow
- 模型拒绝响应

所以 memory 的设计目标不是“永远记住全部”，而是：**在有限上下文窗口内，保留最有价值的近期对话历史**

## 总结

可以用一句话概括：**LlamaIndex 的 Chat Engine 是在 Query Engine 基础上，增加“会话记忆 + 问题改写 + 上下文编排 + 流式对话管理”的多轮 RAG 对话执行器。**

它并不是简单的“聊天包装器”，而是一个真正的：

- 对话状态管理器
- 检索增强编排器
- 历史上下文调度器
- 流式交互执行器
