"""
Redis 翻译缓存模块

职责：缓存翻译结果，避免重复调用翻译引擎 API。

缓存键格式：trans:<SHA-256 哈希值>
缓存有效期：7 天（过期后自动删除，下次请求会重新翻译）

容错设计：Redis 不可用时所有操作静默降级（返回未命中），不阻断翻译流程。
"""

import hashlib
import logging

import redis.asyncio as redis
from app.config import get_settings

logger = logging.getLogger(__name__)


class TranslateCache:
    """翻译结果的 Redis 缓存管理器，Redis 故障时自动降级。"""

    def __init__(self):
        self.redis = redis.from_url(
            get_settings().redis_url,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True,
        )
        self.ttl = 86400 * 7

    def _make_key(self, text: str, source: str, target: str, engine) -> str:
        raw = f"{engine}:{source}:{target}:{text}"
        return f"trans:{hashlib.sha256(raw.encode()).hexdigest()}"

    async def get(self, text: str, source: str, target: str, engine) -> str | None:
        try:
            key = self._make_key(text, source, target, engine)
            result = await self.redis.get(key)
            return result.decode() if result else None
        except Exception:
            logger.warning("Redis get 失败，跳过缓存", exc_info=True)
            return None

    async def set(
        self, text: str, source: str, target: str, engine, translated: str
    ):
        try:
            key = self._make_key(text, source, target, engine)
            await self.redis.setex(key, self.ttl, translated)
        except Exception:
            logger.warning("Redis set 失败，跳过缓存写入", exc_info=True)

    async def get_batch(
        self, texts: list[str], source: str, target: str, engine
    ) -> list[str | None]:
        try:
            keys = [self._make_key(t, source, target, engine) for t in texts]
            results = await self.redis.mget(keys)
            return [r.decode() if r else None for r in results]
        except Exception:
            logger.warning("Redis mget 失败，跳过缓存", exc_info=True)
            return [None] * len(texts)
