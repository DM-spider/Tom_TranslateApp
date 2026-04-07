"""
配置管理模块

职责：从环境变量（由 Docker Compose 注入）读取所有配置，转为 Python 对象供其他模块使用。
原理：pydantic-settings 会自动将环境变量名（不区分大小写）匹配到类属性上。

为什么用 @lru_cache？
  Settings 只需要在启动时读取一次。lru_cache 保证后续所有调用
  get_settings() 都返回同一个实例，避免重复读取。
"""

from functools import lru_cache

from pydantic import model_validator, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用全局配置，所有字段都可被环境变量覆盖。"""

    # ---- DeepSeek 翻译引擎 ----
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    # ---- Gemini 翻译引擎 ----
    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com"
    gemini_model: str = "gemini-2.5-flash"

    # ---- 百度翻译引擎（预留） ----
    baidu_app_id: str = ""
    baidu_secret_key: str = ""

    # ---- LibreTranslate ----
    libre_translate_url: str = "http://libretranslate:5000"

    # ---- Redis ----
    redis_url: str = "redis://redis:6379/0"

    # ---- 应用配置 ----
    cors_origins: str = "https://tomtranslate.com,https://www.tomtranslate.com,https://api.tomtranslate.com,chrome-extension://*"
    debug: bool = False
    rate_limit_per_minute: int = 30

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    free_daily_page_translations: int = 10
    free_daily_text_translations: int = 100

    # ---- 数据库 ----
    database_url: str = Field(
        default="postgresql+asyncpg://translate:translate_prod@db:5432/translate_db",
        min_length=1,
    )

    # ---- JWT 认证 ----
    jwt_secret_key: str = "change-me-in-production-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # ---- API Key 认证 ----
    api_secret_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_security_defaults(self):
        if not self.debug and self.jwt_secret_key == "change-me-in-production-use-a-long-random-string":
            raise ValueError("生产环境必须显式设置 JWT_SECRET_KEY")
        if not self.database_url.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL 必须使用 PostgreSQL asyncpg 连接串")
        return self


@lru_cache
def get_settings() -> Settings:
    """获取全局配置单例。整个应用生命周期内只会创建一次 Settings 实例。"""
    return Settings()
