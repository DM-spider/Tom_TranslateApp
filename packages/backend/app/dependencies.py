"""
认证依赖注入

提供两个 FastAPI 依赖函数：
  - get_current_user()：必须登录，否则 401
  - get_optional_user()：可选登录，未登录返回 None
"""

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User

settings = get_settings()

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token 提取器（auto_error=False 使其在无 token 时不自动报错）
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """将明文密码哈希为 bcrypt 格式。"""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """验证明文密码是否匹配哈希值。"""
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    """生成 JWT access_token。"""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> int | None:
    """解码 JWT，返回 user_id；无效时返回 None。"""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except (JWTError, ValueError):
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """必须登录的依赖。未提供 token 或 token 无效时返回 401。"""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证信息，请先登录",
        )
    user_id = decode_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="认证信息无效或已过期，请重新登录",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """可选登录的依赖。未登录时返回 None，不报错。"""
    if credentials is None:
        return None
    user_id = decode_token(credentials.credentials)
    if user_id is None:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
