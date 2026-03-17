"""
DeepSeek 翻译引擎

调用方式：通过 OpenAI 官方 Python SDK（openai 包）调用 DeepSeek API。
DeepSeek 的 API 完全兼容 OpenAI 的接口协议，只需把 base_url 改成 https://api.deepseek.com 即可。

核心策略 — [SEP] 分段合并：
  多段文本用 [SEP] 分隔符合并为一个请求，返回后按 [SEP] 拆分。
  用户原文中的 [SEP] 会在发送前被转义，收到结果后再还原。
"""

import asyncio

from openai import AsyncOpenAI
from app.config import get_settings
from .base import BaseEngine, TranslateResult

SEP = "\n[SEP]\n"
ESCAPE_PLACEHOLDER = "[[_SEP_ESCAPED_]]"
API_TIMEOUT_SECONDS = 30

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
        self.client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout=API_TIMEOUT_SECONDS,
        )
        self.model = settings.deepseek_model

    async def translate(
        self, texts: list[str], source_lang: str, target_lang: str
    ) -> TranslateResult:
        # 转义用户原文中的 [SEP]，防止与分隔符混淆
        safe_texts = [t.replace("[SEP]", ESCAPE_PLACEHOLDER) for t in texts]
        combined = SEP.join(safe_texts)
        lang_display = source_lang if source_lang != "auto" else "the detected language"

        response = await asyncio.wait_for(
            self.client.chat.completions.create(
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
                temperature=0.3,
            ),
            timeout=API_TIMEOUT_SECONDS,
        )

        result_text = response.choices[0].message.content.strip()
        translated_texts = [
            t.strip().replace(ESCAPE_PLACEHOLDER, "[SEP]")
            for t in result_text.split("[SEP]")
        ]

        if len(translated_texts) != len(texts):
            translated_texts = (translated_texts + [""] * len(texts))[: len(texts)]

        return TranslateResult(
            translated_texts=translated_texts,
            source_lang=source_lang,
            engine_used=self.engine_name,
            tokens_used=response.usage.total_tokens if response.usage else None,
        )
