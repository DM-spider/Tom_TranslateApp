"""
配置管理模块

职责：从项目根目录的 .env 文件中读取所有环境变量，转为 Python 对象供其他模块使用。
原理：pydantic-settings 会自动将 .env 中的变量名（不区分大小写）匹配到类属性上。
      例如 .env 中的 DEEPSEEK_API_KEY 会自动填入 Settings.deepseek_api_key。

为什么用 @lru_cache？
  Settings 只需要在启动时读取一次 .env 文件。lru_cache 保证后续所有调用
  get_settings() 都返回同一个实例，避免重复读取文件。
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用全局配置，所有字段都可被 .env 文件中的同名变量覆盖。"""

    # ---- DeepSeek 翻译引擎 ----
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    # ---- Gemini 翻译引擎 ----
    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com"
    gemini_model: str = "gemini-2.5-flash"

    # ---- 百度翻译引擎（预留，暂未启用） ----
    baidu_app_id: str = ""
    baidu_secret_key: str = ""

    # ---- Redis 缓存连接 ----
    redis_url: str = "redis://localhost:6379/0"

    # ---- 应用运行配置 ----
    cors_origins: str = "http://localhost:3000,chrome-extension://*"  # 允许跨域的前端地址
    debug: bool = True
    rate_limit_per_minute: int = 30  # 每分钟最大请求次数

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    free_daily_page_translations: int = 10   # 每日免费整页翻译次数
    free_daily_text_translations: int = 100  # 每日免费文本翻译次数

    # pydantic-settings 的内部配置：指定 .env 文件路径
    # 路径是相对于 uvicorn 启动时的工作目录（packages/backend/），所以 ../../.env 指向项目根目录
    model_config = {"env_file": "../../.env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    """获取全局配置单例。整个应用生命周期内只会创建一次 Settings 实例。"""
    return Settings()
