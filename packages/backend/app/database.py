"""
数据库连接模块

职责：创建 SQLAlchemy 异步引擎和会话工厂，供依赖注入使用。
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。"""
    pass


async def get_db():
    """FastAPI 依赖注入：每个请求获取一个数据库会话，请求结束后自动关闭。"""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """创建所有表（开发阶段用，生产环境应使用 Alembic 迁移）。"""
    from app.models import usage as _usage  # noqa: F401
    from app.models import user as _user  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """关闭数据库连接池。"""
    await engine.dispose()
