---
title: 14-Program-Aided Language Models
date: 2026-03-27 14:25:23
tags: 
  - PAL
categories:
  - Prompting Techniques
---

| 版本 | 内容 | 时间                   |
| ---- | ---- | ---------------------- |
| V1   | 新建 | 2026年03月27日14:25:26 |

> 论文：https://arxiv.org/abs/2211.10435
>
> 官方网站：https://reasonwithpal.com/

## PAL 核心是什么？

PAL（程序辅助语言模型）是**让大模型 “写代码解题” 的提示词方法**，核心逻辑：**大模型只负责把自然语言问题转化为可执行的程序代码（如 Python），不直接计算答案；真正的解题计算，交给 Python 解释器、计算器等专业运行环境完成**。

简单说：**大模型做 “翻译官”（自然语言→代码），专业程序环境做 “计算师”（执行代码出结果）**，彻底避开大模型在数学计算、逻辑推理中容易算错、出现幻觉的问题。

![](./14-Program-Aided%20Language%20Models(PAL)_img/image-20260327143705658.png)

## PAL 和 COT 的区别

| 方法         | 核心推理方式                 | 答案生成方式                 | 优点                       | 缺点                               | 适用场景                                      |
| ------------ | ---------------------------- | ---------------------------- | -------------------------- | ---------------------------------- | --------------------------------------------- |
| CoT 思维链   | 用**自然语言文字**一步步推理 | 大模型直接输出答案           | 适配所有场景、无需额外环境 | 计算类问题易出错、幻觉多           | 文本理解、常识推理、简单问答                  |
| PAL 程序辅助 | 用**可执行代码**作为推理步骤 | 专业运行环境执行代码输出答案 | 计算精准、无幻觉、结果可靠 | 依赖代码运行环境、仅适配可量化问题 | 数学计算、日期 / 时间推算、数据统计、逻辑运算 |

## 案例

```python
import os
import datetime
from dateutil.relativedelta import relativedelta
from openai import OpenAI

# ====================== 配置 ======================
API_KEY = "此处填入你的 OPENAI_API_KEY"
client = OpenAI(
    api_key=API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
)


# ===================================================

def run_pal_calculation(question: str) -> str:
    """
    PAL 核心函数：
    1. 给 LLM 提示词
    2. 让 LLM 生成 Python 代码
    3. 安全执行代码
    4. 返回答案
    """

    # PAL 固定提示词（让模型生成日期计算代码）
    prompt = f"""
        你是一个日期计算专家。
        把问题转换成可运行的 Python 代码，使用 datetime 和 relativedelta。
        只输出代码，不要任何解释、文字、注释。
        
        问题：今天是2023年2月27日，我出生在25年前，出生日期是？
        代码：
        today = datetime(2023, 2, 27)
        born = today - relativedelta(years=25)
        result = born.strftime('%m/%d/%Y')
        
        问题：2025年3月27日的3天后是？
        代码：
        today = datetime(2025, 3, 27)
        result = (today + relativedelta(days=3)).strftime('%m/%d/%Y')
        
        问题：{question}
        代码：
        """.strip()

    # 1. 调用 LLM 生成代码
    response = client.chat.completions.create(
        model="qwen3.5-plus",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )
    code = response.choices[0].message.content.strip()

    print(f"LLM 生成的代码：\n{code}")


    # 2. 安全执行代码（PAL 核心）
    local_vars = {}
    try:
        # 只允许安全的函数，禁止系统操作
        safe_globals = {
            "datetime": datetime.datetime,
            "relativedelta": relativedelta
        }
        exec(code, safe_globals, local_vars)
        return f"✅ 计算结果：{local_vars.get('result', '无结果')}"
    except Exception as e:
        return f"❌ 执行失败：{str(e)}"


# ====================== 测试 ======================
if __name__ == "__main__":
    question = "今天是2025年3月27日，100天以后是几月几号？"
    print(run_pal_calculation(question))
```

## 注意点

PAL 的核心风险在于**执行大模型生成的代码，落地时必须做好以下防护，避免线上问题：

1. **沙箱隔离**：绝对不能让大模型生成的代码直接在生产环境执行，需搭建**轻量代码沙箱**，限制代码的系统调用、文件访问、网络请求；
2. **代码校验**：执行前对大模型生成的代码做**语法校验 + 规则过滤**，禁止包含`os`、`subprocess`、`socket`等危险库的调用，仅允许业务所需的基础库（如`datetime`、`math`）；
3. **超时限制**：给代码执行设置**严格的超时时间**，防止死循环、耗时计算占用服务器资源；
4. **示例固化**：在提示词中固化**业务专属的代码示例**，让大模型仅生成符合业务规范的代码，避免生成非预期的代码格式；
5. **temperature 设 0**：调用大模型生成代码时，将`temperature`设为 0，让模型生成确定性的代码，避免随机生成错误代码。

