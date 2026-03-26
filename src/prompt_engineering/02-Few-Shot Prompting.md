---
title: 02-Few-Shot Prompting
date: 2026-03-24 20:54:23
tags: 
  - Few-Shot Prompting
categories:
  - Prompting Techniques
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年03月24日20:54:43 |

## 简介

尽管大语言模型展现出了惊人的零样本能力，但在零样本设置下处理更复杂任务时，它们仍然存在不足。

少样本提示可作为一种实现**上下文学习（in-context learning）** 的技术 —— 我们在提示词中提供一些示范示例，引导模型获得更好的性能。

这些示范示例会为后续任务（即我们希望模型生成响应的任务）提供 “条件引导”。

## 案例

### 简单案例

经典例子（来自 https://arxiv.org/pdf/2005.14165 论文），演示怎么用**给几个例句**的方式，让大模型学会用一个新词造句。

*Prompt:*

```
A "whatpu" is a small, furry animal native to Tanzania. 
An example of a sentence that uses the word whatpu is:
We were traveling in Africa and we saw these very cute whatpus.

To do a "farduddle" means to jump up and down really fast. 
An example of a sentence that uses the word farduddle is:
```

*模型输出:*

```
When we won the game, we all started to farduddle in celebration.
```



**whatpu 和 farduddle 都是编造的假词**，现实里不存在

这里只在提示里**给了 1 个例子（few-shot）**，模型看完例子，立刻学会了：

- 先看懂新词定义
- 再模仿句式，自己造一个通顺合理的句子

> https://arxiv.org/pdf/2005.14165 论文的一个结论是：
>
> 1. 少样本学习（仅通过少量任务示例作为上下文提示，无需权重更新）是 GPT-3 的核心优势，且模型规模越大，对上下文信息的利用效率越高。相比传统微调方法，少样本学习大幅减少了对任务特定标注数据的依赖，降低了数据收集成本，同时减少了模型对特定任务数据分布的过拟合风险，提升了泛化能力。
> 2. 部分任务中，GPT-3 仅需 10-100 个示例即可达到接近微调模型的效果，展现出类似人类快速学习新任务的能力，为通用语言系统的开发提供了新路径。

仅给模型提供**一个示例（即 “单样本学习”，1-shot）**，模型就能以某种方式学会如何完成任务。对于更复杂的任务，我们可以尝试**增加示范示例的数量**（例如 3 样本、5 样本、10 样本等）。

### 格式的重要性

根据论文 https://arxiv.org/pdf/2202.12837

用少样本提示时，**不用纠结示例的标签对不对**，重点抓 3 件事就行：

1. 先告诉模型 “**有哪些标签可选**”（比如情感分析只有 “正面 / 负面”），以及 “**输入都是啥样的**”（比如都是商品评论），哪怕标签标错了也没关系；
2. **示例格式要统一**（比如固定写成 “文本：XXX → 标签：XXX”），就算标签瞎填（比如把负面评论标成正面），也比不给标签强太多 —— 格式能让模型知道 “该怎么输出”；
3. 要是随机填标签，别瞎按 1:1 比例填（比如一半正面一半负面），尽量贴合真实情况的比例（比如现实中正面评论更多就多填点正面），这样模型表现会更稳。



下面是一组少样本情感分析的示范示例，核心是通过 “句子 + 标签” 的配对，让模型学习反向情感标注规则（与常规相反：正面表述标 Negative，负面表述标 Positive），最终需为最后一句标注标签：

*Prompt*：

```
This is awesome! // Negative
This is bad! // Positive
Wow that movie was rad! // Positive
What a horrible show! //
```

*模型输出*：

```
Negative
```

1. 示范示例的核心是传递 “反向标注规则”：常规情感分析中 “awesome/rad” 对应 Positive、“bad/horrible”对应 Negative，但此处示例强制反转了这一逻辑；
2. 最后一句 “What a horrible show!”为负面表述，按示范规则需标注 Negative，与前文 “bad”标 Positive 的反向逻辑一致；
3. 这种 “故意反转标签” 的示范，上述论文中 “**标签正确性无关紧要，关键是明确标签空间和格式**” 的体现 —— 模型关注的是 **“句子→标签” 的配对格式和标签选项（Positive/Negative），而非标签是否符合字面情感**。

实际上现在的大模型即使面对**杂乱无章、不规范的输入格式**，也表现得越来越**稳定**

*Prompt:*

```
Positive This is awesome! 
This is bad! Negative
Wow that movie was rad!
Positive
What a horrible show! --
```

*Output:*

```
Negative
```

上面这些**格式完全不统一、乱七八糟**，但模型依然**预测出了正确的标签**。

