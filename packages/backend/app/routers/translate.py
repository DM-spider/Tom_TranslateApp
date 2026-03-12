"""
翻译 API 路由

职责：定义对外暴露的 HTTP 接口，接收前端请求，调用翻译服务，返回结果。

提供的接口：
  POST /api/v1/translate  — 核心翻译接口，接收文本和配置，返回翻译结果
  GET  /api/v1/languages  — 获取所有支持的语言列表（前端用来渲染语言选择下拉菜单）

路由前缀 /api/v1：
  加上版本号 v1，方便未来做不兼容升级时新增 /api/v2 而不影响旧接口。
"""

from fastapi import APIRouter, HTTPException
from app.services.engines.base import TranslateRequest, TranslateResult
from app.services.translator import TranslatorService

# 创建路由器，统一前缀 /api/v1，在自动文档中归类为 "translate" 标签
router = APIRouter(prefix="/api/v1", tags=["translate"])

# 创建翻译服务实例（全局单例，应用启动时初始化一次）
translator = TranslatorService()

# 支持的语言列表（语言代码 → 显示名称）
# 前端调用 GET /api/v1/languages 获取这个列表来渲染下拉菜单
SUPPORTED_LANGUAGES = {
    "auto": "自动检测",
    "zh-CN": "中文",
    "en": "English",
    "ja": "日本語",
    "ko": "한국어",
    "fr": "Français",
    "de": "Deutsch",
    "es": "Español",
    "ru": "Русский",
}


@router.post("/translate", response_model=TranslateResult)
async def translate(req: TranslateRequest):
    """
    核心翻译接口。

    请求示例（JSON）：
    {
        "texts": ["Hello, world!", "How are you?"],
        "source_lang": "auto",
        "target_lang": "zh-CN",
        "engine": "deepseek"
    }

    返回示例：
    {
        "translated_texts": ["你好，世界！", "你好吗？"],
        "source_lang": "auto",
        "engine_used": "deepseek",
        "tokens_used": 125
    }
    """
    try:
        return await translator.translate(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/languages")
async def get_languages():
    """返回支持的语言列表，供前端渲染语言选择下拉菜单。"""
    return SUPPORTED_LANGUAGES
