"""
DeepSeek 翻译引擎

调用方式：通过 OpenAI 官方 Python SDK（openai 包）调用 DeepSeek API。
为什么不用 DeepSeek 自己的 SDK？
  因为 DeepSeek 的 API 完全兼容 OpenAI 的接口协议（相同的请求/响应格式），
  只需要把 base_url 改成 https://api.deepseek.com 即可，无需额外的 SDK。
  这也意味着如果你未来想切换到 OpenAI，只需修改 .env 中的地址和密钥。

核心策略 — [SEP] 分段合并：
  当一次传入多段文本时，不是逐条发送 API 请求（太慢、太费 token），
  而是用 [SEP] 分隔符将所有文本拼成一个字符串发送，让大模型一次翻译完，
  返回后再按 [SEP] 拆开。这样一次 API 调用就能处理多段文本。
"""

from openai import AsyncOpenAI  # DeepSeek 兼容 OpenAI 协议，直接用这个 SDK
from app.config import get_settings
from .base import BaseEngine, TranslateResult

# 多段文本的分隔符，发给大模型时用它拼接，收到结果后用它拆分
SEP = "\n[SEP]\n"

# 系统提示词：告诉大模型它的角色和翻译规则
# {source_lang} 和 {target_lang} 是占位符，调用时会替换成实际语言
SYSTEM_PROMPT = """You are a professional translator.
Translate the user's text from {source_lang} to {target_lang}.
Rules:
- Produce natural, fluent, idiomatic translations
- Maintain the original formatting
- Keep proper nouns, brand names, and technical terms unchanged when appropriate
- If the input contains segments separated by [SEP], translate each segment independently and keep [SEP] as the separator in your output
- Output ONLY the translation, no explanations or notes"""


class DeepSeekEngine(BaseEngine):
    """DeepSeek 大模型翻译引擎，适合需要高质量、上下文感知翻译的场景。"""

    engine_name = "deepseek"

    def __init__(self):
        settings = get_settings()
        # 创建异步 OpenAI 客户端，指向 DeepSeek 的 API 地址
        self.client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
        self.model = settings.deepseek_model

    async def translate(
        self, texts: list[str], source_lang: str, target_lang: str
    ) -> TranslateResult:
        # 将多段文本用 [SEP] 拼接成一个字符串，减少 API 调用次数
        combined = SEP.join(texts)
        lang_display = source_lang if source_lang != "auto" else "the detected language"

        # 调用 DeepSeek Chat API（兼容 OpenAI chat.completions 接口）
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT.format(
                        source_lang=lang_display, target_lang=target_lang
                    ),
                },
                {"role": "user", "content": combined},
            ],
            temperature=0.3,  # 较低的温度让翻译结果更稳定、更少随机性
        )

        # 从响应中提取翻译文本，按 [SEP] 拆分回列表
        result_text = response.choices[0].message.content.strip()
        translated_texts = [t.strip() for t in result_text.split("[SEP]")]

        # 安全兜底：如果大模型返回的段数与输入不匹配（偶尔会发生），
        # 用空字符串补齐不足的部分，或截断多余的部分
        if len(translated_texts) != len(texts):
            translated_texts = (translated_texts + [""] * len(texts))[: len(texts)]

        return TranslateResult(
            translated_texts=translated_texts,
            source_lang=source_lang,
            engine_used=self.engine_name,
            tokens_used=response.usage.total_tokens if response.usage else None,
        )
