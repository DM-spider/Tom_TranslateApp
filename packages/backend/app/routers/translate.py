"""
翻译 API 路由

职责：定义对外暴露的 HTTP 接口，接收前端请求，调用翻译服务，返回结果。

提供的接口：
  POST /api/v1/translate  — 核心翻译接口，接收文本和配置，返回翻译结果
  GET  /api/v1/languages  — 获取所有支持的语言列表（前端用来渲染语言选择下拉菜单）

路由前缀 /api/v1：
  加上版本号 v1，方便未来做不兼容升级时新增 /api/v2 而不影响旧接口。
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_optional_user
from app.models.user import User
from app.models.usage import Usage
from app.services.engines.base import EngineType, TranslateRequest, TranslateResult
from app.services.translator import TranslatorService

# 创建路由器，统一前缀 /api/v1，在自动文档中归类为 "translate" 标签
router = APIRouter(prefix="/api/v1", tags=["translate"])

# 创建翻译服务实例（全局单例，应用启动时初始化一次）
translator = TranslatorService()

# 支持的语言列表（语言代码 → 显示名称）
# 前端调用 GET /api/v1/languages 获取这个列表来渲染下拉菜单
SUPPORTED_LANGUAGES = {
    "auto": "自动检测",
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    "en": "English",
    "ja": "日本語",
    "ko": "한국어",
    "fr": "Français",
    "de": "Deutsch",
    "es": "Español",
    "ru": "Русский",
}


@router.post("/translate", response_model=TranslateResult)
async def translate(
    req: TranslateRequest,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    核心翻译接口。

    配额规则：
    - 免费引擎（libre）：任何人都可用，无需登录
    - LLM 引擎（deepseek / gemini）：需要登录
      - free 用户：每日 10 次
      - pro 用户：不限

    请求示例（JSON）：
    {
        "texts": ["Hello, world!", "How are you?"],
        "source_lang": "auto",
        "target_lang": "zh-CN",
        "engine": "deepseek"
    }
    """
    try:
        # 免费引擎：任何人都可以用
        if req.engine == EngineType.LIBRE:
            return await translator.translate(req)

        # LLM 引擎：需要登录
        if user is None:
            raise HTTPException(
                status_code=403,
                detail="使用 AI 翻译需要登录，免费机器翻译无需登录",
            )

        # 检查配额
        today = date.today()
        daily_limit = 999999 if user.plan == "pro" else 10

        result = await db.execute(
            select(Usage).where(Usage.user_id == user.id, Usage.date == today)
        )
        usage = result.scalar_one_or_none()
        today_count = usage.llm_count if usage else 0

        if today_count >= daily_limit:
            raise HTTPException(
                status_code=429,
                detail=f"今日 AI 翻译次数已用完（{daily_limit}次），请使用免费机器翻译或升级 Pro",
            )

        # 执行翻译
        translate_result = await translator.translate(req)

        # 记录用量
        if usage:
            usage.llm_count += 1
            await db.commit()
        else:
            new_usage = Usage(user_id=user.id, date=today, llm_count=1)
            db.add(new_usage)
            await db.commit()

        return translate_result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RedisConnectionError:
        raise HTTPException(status_code=503, detail="缓存服务暂时不可用，请稍后重试")
    except Exception as e:
        import logging
        logging.exception("翻译引擎调用失败")
        safe_msg = "翻译引擎调用失败，请稍后重试"
        err_type = type(e).__name__
        if err_type in ("AuthenticationError", "PermissionDeniedError"):
            safe_msg = "翻译引擎认证失败，请检查 API Key 配置"
        elif err_type in ("RateLimitError",):
            safe_msg = "翻译引擎请求过于频繁，请稍后重试"
        elif err_type in ("Timeout", "TimeoutError", "ConnectTimeout", "ReadTimeout"):
            safe_msg = "翻译引擎响应超时，请稍后重试"
        raise HTTPException(status_code=502, detail=safe_msg)


@router.get("/languages")
async def get_languages():
    """返回支持的语言列表，供前端渲染语言选择下拉菜单。"""
    return SUPPORTED_LANGUAGES
