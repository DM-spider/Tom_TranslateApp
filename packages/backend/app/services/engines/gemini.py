"""
Gemini 翻译引擎

调用方式：通过 Google 官方 Python SDK（google-genai 包）调用 Gemini API。
与 DeepSeek 引擎的区别：
  - DeepSeek 使用 OpenAI 兼容协议（chat.completions）
  - Gemini 使用 Google 自有协议（generate_content）
  两者的翻译逻辑和 [SEP] 分段策略完全一致，只是底层 SDK 调用方式不同。

异步调用：使用 client.aio.models.generate_content（aio = async I/O），
  不会阻塞事件循环，能同时处理多个翻译请求。
"""

from google import genai
from app.config import get_settings
from .base import BaseEngine, TranslateResult

# 多段文本的分隔符（与 DeepSeek 引擎保持一致）
SEP = "\n[SEP]\n"

# 系统提示词（与 DeepSeek 引擎保持一致，确保翻译质量和格式统一）
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
        # 创建 Gemini 客户端，只需 API Key 即可
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.gemini_model

    async def translate(
        self, texts: list[str], source_lang: str, target_lang: str
    ) -> TranslateResult:
        # 将多段文本用 [SEP] 拼接成一个字符串
        combined = SEP.join(texts)
        lang_display = source_lang if source_lang != "auto" else "the detected language"

        # 构造系统提示词，填入实际的源语言和目标语言
        system_instruction = SYSTEM_PROMPT.format(
            source_lang=lang_display, target_lang=target_lang
        )

        # 调用 Gemini API（异步版本：client.aio.models.generate_content）
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=combined,  # 用户输入的待翻译文本
            config=genai.types.GenerateContentConfig(
                system_instruction=system_instruction,  # 系统提示词
                temperature=0.3,  # 较低温度 → 翻译更稳定
            ),
        )

        # 从响应中提取翻译文本，按 [SEP] 拆分回列表
        result_text = response.text.strip()
        translated_texts = [t.strip() for t in result_text.split("[SEP]")]

        # 安全兜底：段数不匹配时补齐或截断
        if len(translated_texts) != len(texts):
            translated_texts = (translated_texts + [""] * len(texts))[: len(texts)]

        # 提取 token 消耗量（Gemini 通过 usage_metadata 返回）
        token_count = None
        if response.usage_metadata:
            token_count = response.usage_metadata.total_token_count

        return TranslateResult(
            translated_texts=translated_texts,
            source_lang=source_lang,
            engine_used=self.engine_name,
            tokens_used=token_count,
        )
