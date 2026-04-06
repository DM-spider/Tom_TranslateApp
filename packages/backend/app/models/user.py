"""
用户模型

字段说明：
  - id:            自增主键
  - email:         用户邮箱（唯一，用于登录）
  - password_hash: bcrypt 哈希后的密码
  - plan:          订阅计划（"free" 或 "pro"）
  - created_at:    注册时间
"""

from datetime import datetime

from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="free")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
