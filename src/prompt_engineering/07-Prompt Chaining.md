---
title: 07-Prompt Chaining
date: 2026-03-26 11:22:06
tags: 
  - Prompt Chaining
categories:
  - Prompting Techniques
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年03月26日11:22:11 |

## 定义

为了提升大语言模型的**可靠性和任务表现**，将**一个复杂整体任务**拆解成**多个简单子任务**，为每个子任务设计专属提示词；

执行时先让模型完成第一个子任务，把它的输出结果作为**下一个子任务提示词的输入**，依次执行直到得到最终结果 —— 这种**多轮提示词有序衔接、形成流程链**的方法，就是**Prompt Chaining**。

## 核心价值

1. 解决模型 “复杂任务无力症”

   直接用超长、超详细的提示词让模型做复杂任务，它会出现理解偏差、遗漏信息、跳步出错；拆分后每个子任务目标单一，模型能精准完成。

2. 提升应用的「可追溯性」

   每个子任务的输出都有记录，哪里出问题一眼就能看出来，不用对着最终错误结果 “瞎猜”。

3. 增强可控性 + 可靠性

   可以针对性优化某一个子任务的提示词，不用整体重构；每一步都把控结果，最终输出会更符合预期。

4. 适配高价值业务场景

   尤其适合做LLM 对话助手、文档问答、个性化内容生成（这些场景都需要多步信息处理）。

## 案例

一个常见用例是回答有关大型文本文件的问题。设计两个不同的提示词，第一个提示负责提取相关的引文来回答问题，第二个提示则以引文和原始文档作为输入来回答给定的问题。

下面的第一个提示会根据问题从文档中提取相关引文。

**场景前提**

- 处理对象：长篇文档（用`{{document}}`作为文档占位符，实际用的时候替换成真实文档即可）
- 所用模型：支持**长上下文**的大模型
- 核心任务：从长篇文档中，精准提取并整理出**所有提到的提示词技术**

*Prompt:*

```
You are a helpful assistant. Your task is to help answer a question given in a document. The first step is to extract quotes relevant to the question from the document, delimited by ####. Please output the list of quotes using <quotes></quotes>. Respond with "No relevant quotes found!" if no relevant quotes were found.
####
{{document}}
####
```

*模型输出*：

```
<quotes> "Common prompting techniques include multi-shot, chain-of-thought, and tree-of-thought prompting, as well as the use of assigning roles to the model." "Common terms used to describe various specific prompt engineering techniques include chain-of-thought, tree-of-thought, and retrieval-augmented generation (RAG)." "Vibe coding is an AI-assisted software development method where a user prompts an LLM with a description of what they want and lets it generate or edit the code." "A prompt may include a few examples for a model to learn from in context, an approach called few-shot learning." "Chain-of-thought (CoT) prompting is a technique that allows large language models (LLMs) to solve a problem as a series of intermediate steps before giving a final answer." "Self-consistency performs several chain-of-thought rollouts, then selects the most commonly reached conclusion out of all the rollouts." "Tree-of-thought prompting generalizes chain-of-thought by generating multiple lines of reasoning in parallel, with the ability to backtrack or explore other paths." "Retrieval-augmented generation is a technique that enables GenAI models to retrieve and incorporate new information." "GraphRAG (coined by Microsoft Research) is a technique that extends RAG with the use of a knowledge graph to allow the model to connect disparate pieces of information, synthesize insights, and understand summarized semantic concepts over large data collections." "Early text-to-image models typically do not understand negation, grammar and sentence structure in the same way as large language models, and may thus require a different set of prompting techniques." "In "prefix-tuning", "prompt tuning", or "soft prompting", floating-point vectors are searched directly by gradient descent to maximize the log-likelihood on outputs." "Automatic prompt optimization techniques refine prompts for large language models by automatically searching over alternative prompt strings using evaluation datasets and task-specific metrics:" </quotes>
```

*Prompt:*

```
Given a set of relevant quotes (delimited by <quotes></quotes>) extracted from a document and the original document (delimited by ####), please compose an answer to the question. Ensure that the answer is accurate, has a friendly tone, and sounds helpful.
####
{{document}}
####
<quotes> "Common prompting techniques include multi-shot, chain-of-thought, and tree-of-thought prompting, as well as the use of assigning roles to the model." "Common terms used to describe various specific prompt engineering techniques include chain-of-thought, tree-of-thought, and retrieval-augmented generation (RAG)." "Vibe coding is an AI-assisted software development method where a user prompts an LLM with a description of what they want and lets it generate or edit the code." "A prompt may include a few examples for a model to learn from in context, an approach called few-shot learning." "Chain-of-thought (CoT) prompting is a technique that allows large language models (LLMs) to solve a problem as a series of intermediate steps before giving a final answer." "Self-consistency performs several chain-of-thought rollouts, then selects the most commonly reached conclusion out of all the rollouts." "Tree-of-thought prompting generalizes chain-of-thought by generating multiple lines of reasoning in parallel, with the ability to backtrack or explore other paths." "Retrieval-augmented generation is a technique that enables GenAI models to retrieve and incorporate new information." "GraphRAG (coined by Microsoft Research) is a technique that extends RAG with the use of a knowledge graph to allow the model to connect disparate pieces of information, synthesize insights, and understand summarized semantic concepts over large data collections." "Early text-to-image models typically do not understand negation, grammar and sentence structure in the same way as large language models, and may thus require a different set of prompting techniques." "In "prefix-tuning", "prompt tuning", or "soft prompting", floating-point vectors are searched directly by gradient descent to maximize the log-likelihood on outputs." "Automatic prompt optimization techniques refine prompts for large language models by automatically searching over alternative prompt strings using evaluation datasets and task-specific metrics:" </quotes>
```

*模型输出*：

```
您好！根据文档内容及相关引用，这篇文档中详细介绍了多种提示词工程（Prompt Engineering）技术。为了方便您查阅，我将这些技术整理成了以下几个类别：

1. 基础与推理增强技术
这些技术主要用于提升模型在处理复杂任务时的逻辑推理能力和准确性：

Multi-shot / Few-shot learning（少样本学习）：在提示词中包含少量示例（exemplars），让模型在上下文中学习如何完成任务。
Chain-of-thought (CoT，思维链)：引导模型通过一系列中间推理步骤来解决问题，模仿人类的思维过程。它可以是 few-shot（提供示例）或 zero-shot（如附加"Let's think step-by-step"）。
Tree-of-thought (ToT，思维树)：CoT 的泛化版本，允许模型并行生成多条推理线，并能使用搜索算法（如广度优先、深度优先）进行回溯或探索其他路径。
Self-consistency（自一致性）：执行多次 CoT 推理，然后选择所有结果中出现频率最高的结论，以提高可靠性。
Assigning roles（分配角色）：为模型分配特定角色或性格，引导其生成更符合预期的响应。
2. 检索与上下文增强技术
这些技术旨在通过外部信息补充模型的 knowledge，减少幻觉：

Retrieval-augmented generation (RAG，检索增强生成)：使模型能够检索并结合数据库、文档或网络来源的新信息来生成回答。
GraphRAG：RAG 的扩展，结合知识图谱连接离散信息，帮助模型综合见解和理解语义概念。
Context engineering（上下文工程）：虽然相关，但侧重于管理伴随提示词的上下文元素（如系统指令、工具定义、元数据等），以提高可靠性和 token 效率。
3. 自动化与优化技术
这些方法利用算法或模型自身来优化提示词，减少人工 trial-and-error：

Automatic prompt generation/optimization（自动提示生成/优化）：使用优化算法（如 MIPRO、GEPA）自动搜索更好的提示词字符串。
Prefix-tuning / Prompt tuning / Soft prompting：通过梯度下降直接搜索浮点向量（而非 token 序列）来最大化输出似然。
Using LLMs to generate prompts：利用一个 LLM 为另一个 LLM 生成指令或 CoT 示例（如 auto-CoT）。
4. 特定模态与应用技术
针对不同输出类型或特定应用场景的技术：

Text-to-image prompting（文生图提示）：包含主题、风格、光照等描述。技巧包括使用负向提示词（negative prompts）、调整词序权重、模仿特定艺术家风格（如"in the style of Greg Rutkowski"）以及 textual inversion（文本反转）。
Image prompting（图像提示）：如 Segment Anything 模型可接受边界框、分割掩码等作为提示。
Vibe coding：一种 AI 辅助软件开发方法，用户用自然语言描述需求，让 LLM 生成或编辑代码。
5. 安全与对抗技术
Prompt injection（提示词注入）：虽然这是一种网络安全攻击技术，但文档也将其列为一种针对机器学习模型的输入 craft 方法，旨在诱导模型产生意外行为或绕过 safeguards。
希望这份总结能帮助您快速了解文档中提到的提示词技术！如果您对其中的某项技术感兴趣，欢迎随时问我。
```

