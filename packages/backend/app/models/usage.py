"""
用量追踪模型

字段说明：
  - id:       自增主键
  - user_id:  关联用户 ID
  - date:     日期（用于按天统计）
  - llm_count: 当天 LLM 翻译次数
"""

from datetime import date as date_type

from sqlalchemy import Integer, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Usage(Base):
    __tablename__ = "usage"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    llm_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date"),
    )
