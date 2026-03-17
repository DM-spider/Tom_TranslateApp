"""
翻译引擎 — 基类与数据模型

本文件定义了三样东西：
1. EngineType 枚举：列出所有可用的翻译引擎名称
2. TranslateRequest / TranslateResult：翻译请求和响应的数据结构
3. BaseEngine 抽象基类：所有翻译引擎都必须继承它并实现 translate() 方法

为什么需要基类？
  项目支持多个翻译引擎（DeepSeek、Gemini、未来可能加百度），
  它们的输入/输出格式必须统一，调度层（translator.py）才能用一套逻辑处理所有引擎。
  新增引擎只需：创建新文件 → 继承 BaseEngine → 实现 translate() → 在 translator.py 中注册。
"""

from abc import ABC, abstractmethod
from pydantic import BaseModel, field_validator
from enum import Enum

MAX_TEXTS_COUNT = 50
MAX_TEXT_LENGTH = 5000


class EngineType(str, Enum):
    """可选的翻译引擎类型。前端通过传入这些值来指定使用哪个引擎。"""
    DEEPSEEK = "deepseek"
    GEMINI = "gemini"
    BAIDU = "baidu"  # 预留，暂未实现


class TranslateRequest(BaseModel):
    """
    翻译请求的数据结构（由前端/客户端传入）。

    字段说明：
    - texts:       要翻译的文本列表，支持一次传入多段文本批量翻译
    - source_lang: 源语言代码，"auto" 表示自动检测
    - target_lang: 目标语言代码，默认翻译成中文
    - engine:      使用哪个翻译引擎，默认 DeepSeek
    """
    texts: list[str]
    source_lang: str = "auto"
    target_lang: str = "zh-CN"
    engine: EngineType = EngineType.DEEPSEEK

    @field_validator("texts")
    @classmethod
    def validate_texts(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("texts 不能为空")
        # 过滤空白字符串，避免浪费 API 额度
        v = [t for t in v if t.strip()]
        if not v:
            raise ValueError("texts 中没有有效文本（全部为空）")
        if len(v) > MAX_TEXTS_COUNT:
            raise ValueError(f"单次最多翻译 {MAX_TEXTS_COUNT} 段文本")
        for i, text in enumerate(v):
            if len(text) > MAX_TEXT_LENGTH:
                raise ValueError(
                    f"第 {i + 1} 段文本超过 {MAX_TEXT_LENGTH} 字符限制"
                )
        return v


class TranslateResult(BaseModel):
    """
    翻译结果的数据结构（返回给前端/客户端）。

    字段说明：
    - translated_texts: 翻译后的文本列表，顺序与请求中的 texts 一一对应
    - source_lang:      实际检测到的源语言
    - engine_used:      实际使用的引擎名称
    - tokens_used:      本次翻译消耗的 token 数（百度等非 AI 引擎为 None）
    """
    translated_texts: list[str]
    source_lang: str
    engine_used: str
    tokens_used: int | None = None


class BaseEngine(ABC):
    """
    翻译引擎抽象基类。

    所有具体引擎（DeepSeekEngine、GeminiEngine 等）都必须：
    1. 设置 engine_name 属性（用于日志和返回结果标识）
    2. 实现 translate() 异步方法
    """
    engine_name: str

    @abstractmethod
    async def translate(
        self,
        texts: list[str],
        source_lang: str,
        target_lang: str,
    ) -> TranslateResult: ...
