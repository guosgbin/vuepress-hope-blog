---
title: 15-ReAct Prompting
date: 2026-03-30 15:49:07
tags: 
  - ReAct
categories:
  - Prompting Techniques
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年03月30日15:49:12 |

## ReAct 是什么

![](./15-ReAct%20Prompting_img/diagram.png)

ReAct Prompting（推理与行动提示）是 2022 年提出的提示工程技术，核心是让大模型交替执行**思考（Thought）、行动（Action）、观察（Observation）** 三步循环。它融合思维链推理与工具交互，先通过思考明确推理路径与待办，再调用搜索、查询等外部工具行动，最后基于工具返回的观察结果修正推理、迭代执行。相比纯思维链，它能接入外部信息、减少幻觉、提升复杂任务（如事实验证、工具规划）的准确性与可解释性，是构建 AI 智能体的主流范式。

- 纯 LLM（普通问答）：靠训练知识，**幻觉严重、知识过时、复杂题推不明白**

- CoT 思维链（只思考不动手）：逻辑能拆，但**错前提一路错到底，没法查资料纠正**

- 纯工具调用（只动手不思考）：只会瞎搜、无脑调接口，**不会整合信息、不会收敛答案**

✅ ReAct 补齐三者短板：**有逻辑、能查证、可纠错、可追溯**

## ReAct 工作原理

ReAct 是**推理（Reason）+ 行动（Act）的**协同提示范式，**让大模型遵循思考→行动→观察**的闭环流程工作：

1. 先通过思考拆解任务、规划推理逻辑，判断是否需要外部工具；
2. 再执行搜索、计算等行动获取真实信息；
3. 基于观察结果修正推理，循环迭代直至信息充足，最终输出答案；

它将内生推理与外部工具结合，解决模型知识滞后、幻觉问题，是 AI 智能体的核心工作逻辑。

```Mermaid
flowchart TD
    A[用户提问] --> B[模型: Thought 推理拆解]
    B --> C{是否需要外部信息?}
    C -- 是 --> D[模型: Action 发起工具调用]
    D --> E[系统执行工具/接口/搜索]
    E --> F[返回 Observation 真实结果]
    F --> B
    C -- 否 --> G[整合全链路推理]
    G --> H[输出 Final Answer 最终结论]
```

## 案例

下图展示了 ReAct 的一个示例以及执行问答所涉及的不同步骤，来源论文：https://arxiv.org/abs/2210.03629

> 官网：https://react-lm.github.io/

![](./15-ReAct%20Prompting_img/hotpotqa.png)

1. Standard（标准问答）

- 直接给出答案：`iPod`
- 问题：**完全错误**，没有推理过程，也没有查证，属于典型的 “拍脑袋” 回答。

2. Reason only（仅思维链）

- 先推理：“Apple Remote 最初是控制 Apple TV 的，Apple TV 可被 iPhone/iPad/iPod Touch 控制”
- 给出答案：`iPhone, iPad, iPod Touch`
- 问题：**推理前提错误**（Apple Remote 最初控制的是 Front Row 软件，不是 Apple TV），导致结论错误，且无法通过外部信息修正。

3. Act only（仅工具调用）

- 直接执行搜索步骤：`Search[Apple Remote]` → `Search[Front Row]` → `Search[Front Row (software)]`
- 最后 `Finish[yes]` 但没有给出具体答案
- 问题：**只有行动没有思考**，无法整合信息得出结论，流程不完整。

4. ReAct（推理 + 行动协同）

- **Thought 1**：需要先搜索 Apple Remote，确认它最初控制的程序 → `Act 1: Search[Apple Remote]`
- **Obs 1**：得知它最初控制的是 **Front Row 媒体中心程序**
- **Thought 2**：需要搜索 Front Row，确认其他控制设备 → `Act 2: Search[Front Row]`
- **Obs 2**：搜索结果提示更准确的关键词是 `Front Row (software)`
- **Thought 3**：修正搜索词 → `Act 3: Search[Front Row (software)]`
- **Obs 3**：得知 Front Row 可被 Apple Remote 或 **键盘功能键** 控制
- **Thought 4**：整合信息得出结论 → `Act 4: Finish[keyboard function keys]`
- 结果：**答案正确**，且整个思考 - 行动 - 观察的过程透明可追溯。

## LangChain ReAct 的使用

```python
from langchain.agents import load_tools
from langchain.agents import initialize_agent
from langchain_community.chat_models import ChatTongyi


API_KEY = "你的 API_KEY"

if __name__ == '__main__':
    llm = ChatTongyi(
        model="qwen3-max",
        api_key=API_KEY,
    )

    tools = load_tools(["llm-math"], llm=llm)
    agent = initialize_agent(
        tools=tools,
        llm=llm,
        agent="zero-shot-react-description",
        verbose=True,
    )

    result = agent.run(
        "林子祥妻子的年龄是多少"
        "她当前的年龄的 0.23 次方是多少?"
    )

    print(result)

```

输出：

```
> Entering new AgentExecutor chain...
要回答这个问题，我需要知道林子祥妻子的当前年龄。林子祥的妻子是叶蒨文（Sally Yeh），她出生于1961年9月30日。假设当前年份是2024年，那么她的年龄是：

2024 - 1961 = 63岁（如果她的生日已经过了）或62岁（如果还没过）。

由于现在是2024年6月，她的生日（9月30日）还没到，因此她目前是62岁。

接下来，我需要计算62的0.23次方。

Action: Calculator
Action Input: 62 ** 0.23
Observation: Answer: 2.5837476140281987
Thought:我已计算出叶蒨文当前年龄（62岁）的0.23次方约为2.5837。

Final Answer: 林子祥的妻子叶蒨文目前62岁，她的年龄的0.23次方约为2.58。

> Finished chain.
林子祥的妻子叶蒨文目前62岁，她的年龄的0.23次方约为2.58。
```

