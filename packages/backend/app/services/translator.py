"""
翻译调度层（核心模块）

职责：作为翻译服务的统一入口，协调「缓存」和「翻译引擎」的工作。

处理流程（每次翻译请求）：
  1. 接收前端传来的翻译请求（包含多段文本）
  2. 批量查 Redis 缓存 → 找出哪些文本已有缓存、哪些没有
  3. 只把未命中缓存的文本发给翻译引擎（省钱）
  4. 翻译完成后，将新结果写入 Redis 缓存（下次秒回）
  5. 合并「缓存命中 + 新翻译」的结果，按原始顺序返回

为什么要有这一层？
  前端/路由层不需要关心缓存逻辑和引擎选择细节，
  只需要调用 TranslatorService.translate()，剩下的由这一层全权负责。
"""

from .engines.base import BaseEngine, EngineType, TranslateRequest, TranslateResult
from .engines.deepseek import DeepSeekEngine
from .engines.gemini import GeminiEngine
from .cache import TranslateCache


class TranslatorService:
    """翻译服务：管理所有翻译引擎和缓存，对外提供统一的翻译接口。"""

    def __init__(self):
        # 注册所有可用的翻译引擎（引擎类型 → 引擎实例）
        # 新增引擎时，在这里多加一行即可
        self.engines: dict[str, BaseEngine] = {
            EngineType.DEEPSEEK: DeepSeekEngine(),
            EngineType.GEMINI: GeminiEngine(),
        }
        self.cache = TranslateCache()

    async def translate(self, req: TranslateRequest) -> TranslateResult:
        """
        执行翻译，自动利用缓存。

        参数：
            req: 翻译请求，包含待翻译文本列表、语言设置、引擎选择
        返回：
            TranslateResult: 翻译结果，translated_texts 顺序与输入 texts 一一对应
        """
        # 根据请求中指定的引擎类型，取出对应的引擎实例
        engine = self.engines.get(req.engine)
        if engine is None:
            raise ValueError(
                f"翻译引擎 '{req.engine}' 暂未实现，当前可用引擎: {', '.join(str(k.value) for k in self.engines)}"
            )

        # ---- 第 1 步：批量查缓存 ----
        # cached 是一个列表，命中的位置为译文，未命中的位置为 None
        cached = await self.cache.get_batch(
            req.texts, req.source_lang, req.target_lang, req.engine
        )

        # ---- 第 2 步：找出未命中缓存的文本 ----
        uncached_indices = [i for i, c in enumerate(cached) if c is None]
        uncached_texts = [req.texts[i] for i in uncached_indices]

        # ---- 第 3 步：只翻译未命中的部分 ----
        if uncached_texts:
            result = await engine.translate(
                uncached_texts, req.source_lang, req.target_lang
            )

            # ---- 第 4 步：将新翻译结果写入缓存，并填充到 cached 列表中 ----
            for idx, translated in zip(uncached_indices, result.translated_texts):
                await self.cache.set(
                    req.texts[idx],
                    req.source_lang,
                    req.target_lang,
                    req.engine,
                    translated,
                )
                cached[idx] = translated
        else:
            # 全部命中缓存，构造一个空结果用于统一返回逻辑
            result = TranslateResult(
                translated_texts=[],
                source_lang=req.source_lang,
                engine_used=req.engine,
                tokens_used=0,
            )

        # ---- 第 5 步：合并结果返回 ----
        # cached 列表现在已经被完整填充（缓存命中 + 新翻译），直接作为最终结果
        return TranslateResult(
            translated_texts=cached,
            source_lang=result.source_lang,
            engine_used=req.engine,
            tokens_used=result.tokens_used,
        )
