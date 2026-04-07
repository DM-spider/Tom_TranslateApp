"""
认证 API 路由

提供的接口：
  POST /api/v1/auth/register  — 邮箱 + 密码注册
  POST /api/v1/auth/login     — 登录，返回 JWT access_token
  GET  /api/v1/auth/me        — 获取当前用户信息 + 今日用量
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.models.user import User
from app.models.usage import Usage

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ---- 请求/响应模型 ----

class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return value.lower()


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return value.lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserInfo(BaseModel):
    id: int
    email: str
    plan: str
    today_llm_usage: int
    daily_limit: int


# ---- 接口 ----

@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """注册新用户，成功后直接返回 token（免二次登录）。"""
    # 检查邮箱是否已注册
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="该邮箱已注册")

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        plan="free",
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="该邮箱已注册") from None

    await db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """邮箱 + 密码登录，返回 JWT access_token。"""
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserInfo)
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前登录用户的信息和今日 LLM 用量。"""
    today = date.today()
    result = await db.execute(
        select(func.coalesce(Usage.llm_count, 0))
        .where(Usage.user_id == user.id, Usage.date == today)
    )
    today_usage = result.scalar_one_or_none() or 0
    daily_limit = 999999 if user.plan == "pro" else 10

    return UserInfo(
        id=user.id,
        email=user.email,
        plan=user.plan,
        today_llm_usage=today_usage,
        daily_limit=daily_limit,
    )
