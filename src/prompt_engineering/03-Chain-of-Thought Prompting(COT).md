---
title: 03-Chain-of-Thought Prompting(COT)
date: 2026-03-25 15:35:37
tags: 
  - COT
categories:
  - Prompting Techniques
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年03月25日15:35:48 |

## Chain-of-Thought Prompting

![COT](./03-Chain-of-Thought%20Prompting_img/demo.png)

思维链提示（CoT）它通过**中间推理步骤**，让模型具备**复杂推理能力**。可以将它与**少样本提示（few-shot）结合**，在那些**需要先推理再给出回答**的更复杂任务上，获得更好的效果。

> 这是一种只有在足够大规模的语言模型上才会出现的涌现能力。
>
> 论文：https://arxiv.org/pdf/2201.11903

*Prompt*

```
The odd numbers in this group add up to an even number: 4, 8, 9, 15, 12, 2, 1.
A: Adding all the odd numbers (9, 15, 1) gives 25. The answer is False.

The odd numbers in this group add up to an even number: 17,  10, 19, 4, 8, 12, 24.
A: Adding all the odd numbers (17, 19) gives 36. The answer is True.

The odd numbers in this group add up to an even number: 16,  11, 14, 4, 8, 13, 24.
A: Adding all the odd numbers (11, 13) gives 24. The answer is True.

The odd numbers in this group add up to an even number: 17,  9, 10, 12, 13, 4, 2.
A: Adding all the odd numbers (17, 9, 13) gives 39. The answer is False.

The odd numbers in this group add up to an even number: 15, 32, 5, 13, 82, 7, 1. 
A:
```

*输出*：

```
Adding all the odd numbers (15, 5, 13, 7, 1) gives 41. The answer is False.
```

## Zero-shot COT Prompting

![Zero-shot COT](./03-Chain-of-Thought%20Prompting_img/zero-cot.png)

**零样本思维链（Zero-shot CoT）**它的核心做法非常简单：**在原来的提示词后面，加一句 “让我们一步步思考”**。

> 论文：https://arxiv.org/pdf/2205.11916

*Prompt:*

```
I went to the market and bought 10 apples. 
I gave 2 apples to the neighbor and 2 to the repairman. 
I then went and bought 5 more apples and ate 1. 
How many apples did I remain with?
```

*输出:*

```
11 apples
```

答案错误，我们尝试使用这个特殊的提示词。



*Prompt:*

```
I went to the market and bought 10 apples. 
I gave 2 apples to the neighbor and 2 to the repairman. 
I then went and bought 5 more apples and ate 1. 
How many apples did I remain with?
Let's think step by step.
```

*输出:*

```
Let's break this down step by step:

Initial Purchase: You bought 10 apples.
Current count: 10
Giving Away: You gave 2 to the neighbor and 2 to the repairman.
Calculation: 10−2−2=6
Current count: 6
Buying More: You bought 5 more apples.
Calculation: 6+5=11
Current count: 11
Eating: You ate 1 apple.
Calculation: 11−1=10
Current count: 10
You remain with 10 apples.
```

## Automatic Chain-of-Thought

传统 **CoT（思维链）** 要人工写示例，麻烦、费时间、还不一定好。

后来有人让 LLM 自己生成推理链（用 “Let's think step by step”），但**自动生成的推理经常出错**。

错误示例会带偏模型，所以必须让示例**足够多样**，用 “数量 + 覆盖度” 抵消错误影响。

Auto-CoT 包含两个阶段：

1）问题聚类：把相似的数学题 / 逻辑题分成一堆一堆（聚类）。目的：保证最终选出来的示例**覆盖各种题型**，不重复、够多样。

2）每个簇挑一个典型问题，用 Zero-Shot-CoT（让模型自己一步步想）生成推理过程，让模型自动生成思维链示例时，**不要选太长、太复杂的问题**，也**不要选推理步骤特别多的**，**保证示范简单、准确、不容易错。**



过程如下：

![AUTOCOT](./03-Chain-of-Thought%20Prompting_img/auto-cot.png)

Auto-CoT 根本不需要人写例子，它只需要：

1. 给模型**一堆问题**（比如 100 道数学题）
2. 模型自动把相似题目**聚成几类**
3. 每类挑**一道代表题**
4. 对这道代表题用 `Let's think step by step` 自动生成推理链
5. 把这些自动生成的样例拼成 prompt
6. 最后让模型做新题



案例：

**1）【第一步：给模型一堆问题】**

你只需要准备一堆同类型问题，比如：

1. 小明有3个苹果，小红又给了他2个，他一共有多少个？
2. 商店里一支笔5元，买4支需要多少钱？
3. 一本书120页，每天看10页，几天能看完？
4. 一个盒子装6个鸡蛋，8个盒子能装多少个？
5. 小明走1公里需要10分钟，走5公里需要多久？

**2）【第二步：让模型自动聚类（Auto-CoT 第一阶段）】**

*Prompt*：

```
1. 小明有3个苹果，小红又给了他2个，他一共有多少个？
2. 商店里一支笔5元，买4支需要多少钱？
3. 一本书120页，每天看10页，几天能看完？
4. 一个盒子装6个鸡蛋，8个盒子能装多少个？
5. 小明走1公里需要10分钟，走5公里需要多久？
请把这些问题按题型和推理步骤自动分成若干聚类。
```

*输出*：

```
加法：第 1 题（求总数）
乘法：第 2、4、5 题（求总量或总时间）
除法：第 3 题（求天数）
减法：无
```

**3）【第三步：让模型每类选一个代表题（Auto-CoT 第二阶段）】**

*Prompt*：

```
从每个聚类中选择一道最典型、长度适中、推理步骤简单的代表性问题。
```

*输出*：

```
加法代表题：1. 小明有 3 个苹果，小红又给了他 2 个，他一共有多少个？ 
乘法代表题：2. 商店里一支笔 5 元，买 4 支需要多少钱？ 
除法代表题：3. 一本书 120 页，每天看 10 页，几天能看完？
```

**4）【第四步：让模型自动为代表题生成推理链（Zero-Shot-CoT）】**

*Prompt*：

```
对每道代表题，自动生成 step-by-step 推理过程。
```

*输出*：

```
加法代表题
题目：1. 小明有 3 个苹果，小红又给了他 2 个，他一共有多少个？ 推理过程：
确定初始数量：小明原本有 3 个苹果。
确定增加数量：小红给了他 2 个苹果。
执行加法运算：将初始数量与增加数量相加 (3+2 )。
得出结论：计算结果为 5，所以小明一共有 5 个苹果。
乘法代表题

题目：2. 商店里一支笔 5 元，买 4 支需要多少钱？ 推理过程：
确定单价：每支笔的价格是 5 元。
确定数量：需要购买的数量是 4 支。
执行乘法运算：用单价乘以数量来计算总价 (5×4 )。
得出结论：计算结果为 20，所以买 4 支笔需要 20 元。
除法代表题

题目：3. 一本书 120 页，每天看 10 页，几天能看完？ 推理过程：
确定总量：这本书总共有 120 页。
确定效率：每天阅读的进度是 10 页。
执行除法运算：用总页数除以每天阅读的页数，计算所需天数 (120÷10 )。
得出结论：计算结果为 12，所以需要 12 天能看完。
```



**5）【第五步：把这些自动生成的样例组合成最终 prompt】**

*Prompt*：

```
把上面所有代表性问题和推理过程组合成一个少样本提示。
```

*输出*：

```
请根据以下示例，对新提出的数学应用题进行逐步推理并给出答案。

示例 1（加法）：
题目：小明有 3 个苹果，小红又给了他 2 个，他一共有多少个？
推理过程：
1. 确定初始数量：小明原本有 3 个苹果。
2. 确定增加数量：小红给了他 2 个苹果。
3. 执行加法运算：将初始数量与增加数量相加 (3 + 2)。
4. 得出结论：计算结果为 5，所以小明一共有 5 个苹果。
答案：5

示例 2（乘法）：
题目：商店里一支笔 5 元，买 4 支需要多少钱？
推理过程：
1. 确定单价：每支笔的价格是 5 元。
2. 确定数量：需要购买的数量是 4 支。
3. 执行乘法运算：用单价乘以数量来计算总价 (5 × 4)。
4. 得出结论：计算结果为 20，所以买 4 支笔需要 20 元。
答案：20

示例 3（除法）：
题目：一本书 120 页，每天看 10 页，几天能看完？
推理过程：
1. 确定总量：这本书总共有 120 页。
2. 确定效率：每天阅读的进度是 10 页。
3. 执行除法运算：用总页数除以每天阅读的页数，计算所需天数 (120 ÷ 10)。
4. 得出结论：计算结果为 12，所以需要 12 天能看完。
答案：12

现在，请解决以下问题：
[在此处插入新问题]
```

**6）【第六步：输入新题目，让模型自动解答】**

*Prompt*：

```
问题：一个袋子里有8颗糖，7个袋子一共有多少颗糖？
```

模型会用**它自己生成的 Auto-CoT 示例**来解答

*输出*：

```
推理过程：

确定每份数量：每个袋子里有 8 颗糖。
确定份数：一共有 7 个袋子。
执行乘法运算：用每袋的糖果数乘以袋子的数量来计算总数 (8×7 )。
得出结论：计算结果为 56，所以 7 个袋子一共有 56 颗糖。
答案：56
```



> Auto-CoT 这篇论文 **并没有消除 “人工提供问题库” 这一步**。
>
> 它消除的是：
>
> ❌ 不需要人工做的
>
> - 不需要人工**手写推理步骤**
> - 不需要人工**设计高质量 CoT 示例**
> - 不需要人工**挑选多样化例子**
> - 不需要人工**写 step-by-step 示范**
>
> ✅ 仍然需要人工提供的
>
> - 给模型一堆问题数据集
