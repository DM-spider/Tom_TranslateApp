"""
LibreTranslate 免费翻译引擎

通过 HTTP 调用自托管的 LibreTranslate 服务（Docker 容器）。
LibreTranslate 是开源的机器翻译引擎，不消耗任何 API 额度，适合作为免费翻译方案。

注意：LibreTranslate 不支持 "auto" 源语言的所有情况，
      这里对 source_lang 做了简单映射，将 "auto" 转为空字符串让 LibreTranslate 自动检测。
"""

import httpx

from app.config import get_settings
from .base import BaseEngine, TranslateResult

API_TIMEOUT_SECONDS = 30

# LibreTranslate 使用的语言代码映射（项目代码 → LibreTranslate 代码）
LANG_MAP: dict[str, str] = {
    "auto": "auto",
    "zh-CN": "zh",
    "zh-TW": "zt",
    "en": "en",
    "ja": "ja",
    "ko": "ko",
    "fr": "fr",
    "de": "de",
    "es": "es",
    "ru": "ru",
}


class LibreTranslateEngine(BaseEngine):
    """LibreTranslate 免费机器翻译引擎，无需 API Key，适合免费用户。"""

    engine_name = "libre"

    def __init__(self):
        settings = get_settings()
        self.base_url = settings.libre_translate_url.rstrip("/")

    async def translate(
        self, texts: list[str], source_lang: str, target_lang: str
    ) -> TranslateResult:
        src = LANG_MAP.get(source_lang, source_lang)
        tgt = LANG_MAP.get(target_lang, target_lang)

        translated_texts: list[str] = []

        async with httpx.AsyncClient(timeout=API_TIMEOUT_SECONDS) as client:
            for text in texts:
                response = await client.post(
                    f"{self.base_url}/translate",
                    json={
                        "q": text,
                        "source": src,
                        "target": tgt,
                        "format": "text",
                    },
                )
                response.raise_for_status()
                data = response.json()
                translated_texts.append(data.get("translatedText", ""))

        return TranslateResult(
            translated_texts=translated_texts,
            source_lang=source_lang,
            engine_used=self.engine_name,
            tokens_used=None,
        )
