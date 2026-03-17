"""
Gemini 翻译引擎

通过 Google 官方 SDK（google-genai 包）调用 Gemini API。
翻译逻辑和 [SEP] 分段策略与 DeepSeek 引擎一致，底层 SDK 调用方式不同。
用户原文中的 [SEP] 会在发送前被转义，收到结果后再还原。
"""

import asyncio

from google import genai
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


class GeminiEngine(BaseEngine):
    """Google Gemini 大模型翻译引擎，作为 DeepSeek 之外的备选引擎。"""

    engine_name = "gemini"

    def __init__(self):
        settings = get_settings()
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.gemini_model

    async def translate(
        self, texts: list[str], source_lang: str, target_lang: str
    ) -> TranslateResult:
        safe_texts = [t.replace("[SEP]", ESCAPE_PLACEHOLDER) for t in texts]
        combined = SEP.join(safe_texts)
        lang_display = source_lang if source_lang != "auto" else "the detected language"

        system_instruction = SYSTEM_PROMPT.format(
            source_lang=lang_display, target_lang=target_lang
        )

        response = await asyncio.wait_for(
            self.client.aio.models.generate_content(
                model=self.model,
                contents=combined,
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3,
                ),
            ),
            timeout=API_TIMEOUT_SECONDS,
        )

        result_text = response.text.strip()
        translated_texts = [
            t.strip().replace(ESCAPE_PLACEHOLDER, "[SEP]")
            for t in result_text.split("[SEP]")
        ]

        if len(translated_texts) != len(texts):
            translated_texts = (translated_texts + [""] * len(texts))[: len(texts)]

        token_count = None
        if response.usage_metadata:
            token_count = response.usage_metadata.total_token_count

        return TranslateResult(
            translated_texts=translated_texts,
            source_lang=source_lang,
            engine_used=self.engine_name,
            tokens_used=token_count,
        )
