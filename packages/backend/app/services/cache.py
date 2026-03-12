"""
Redis 翻译缓存模块

职责：缓存翻译结果，避免重复调用翻译引擎 API。

工作原理：
  对每次翻译请求，根据「引擎 + 源语言 + 目标语言 + 原文」四要素生成唯一的缓存键。
  如果 Redis 中已有该键的值，直接返回缓存结果，不调用 API（省钱、秒回）。
  如果没有命中，翻译完成后将结果写入 Redis，下次相同请求直接命中缓存。

缓存键格式：trans:<SHA-256 哈希值>
缓存有效期：7 天（过期后自动删除，下次请求会重新翻译）
"""

import hashlib
import redis.asyncio as redis  # redis 包的异步版本，不阻塞事件循环
from app.config import get_settings


class TranslateCache:
    """翻译结果的 Redis 缓存管理器。"""

    def __init__(self):
        # 从配置中读取 Redis 连接地址，创建异步连接
        self.redis = redis.from_url(get_settings().redis_url)
        self.ttl = 86400 * 7  # 缓存过期时间：7 天（单位：秒）

    def _make_key(self, text: str, source: str, target: str, engine: str) -> str:
        """
        生成缓存键。

        将「引擎:源语言:目标语言:原文」拼接后做 SHA-256 哈希，
        确保不同参数组合对应不同的缓存键，且键的长度固定（不会因原文过长而出问题）。
        """
        raw = f"{engine}:{source}:{target}:{text}"
        return f"trans:{hashlib.sha256(raw.encode()).hexdigest()}"

    async def get(self, text: str, source: str, target: str, engine: str) -> str | None:
        """查询单条缓存。命中返回译文字符串，未命中返回 None。"""
        key = self._make_key(text, source, target, engine)
        result = await self.redis.get(key)
        return result.decode() if result else None

    async def set(
        self, text: str, source: str, target: str, engine: str, translated: str
    ):
        """写入单条缓存，带过期时间（TTL）。"""
        key = self._make_key(text, source, target, engine)
        await self.redis.setex(key, self.ttl, translated)

    async def get_batch(
        self, texts: list[str], source: str, target: str, engine: str
    ) -> list[str | None]:
        """
        批量查询缓存。

        传入多段原文，一次性查询 Redis（使用 MGET 命令，比逐条查询快得多）。
        返回列表中，命中的位置为译文字符串，未命中的位置为 None。
        """
        keys = [self._make_key(t, source, target, engine) for t in texts]
        results = await self.redis.mget(keys)
        return [r.decode() if r else None for r in results]
