"""
配置管理模块

职责：从项目根目录的 .env 文件中读取所有环境变量，转为 Python 对象供其他模块使用。
原理：pydantic-settings 会自动将 .env 中的变量名（不区分大小写）匹配到类属性上。
      例如 .env 中的 DEEPSEEK_API_KEY 会自动填入 Settings.deepseek_api_key。

为什么用 @lru_cache？
  Settings 只需要在启动时读取一次 .env 文件。lru_cache 保证后续所有调用
  get_settings() 都返回同一个实例，避免重复读取文件。
"""

from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from pydantic import model_validator
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _uses_localhost(url: str) -> bool:
    if not url:
        return False

    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return host in {"localhost", "127.0.0.1", "0.0.0.0"}


def _is_local_origin(origin: str) -> bool:
    lowered = origin.lower()
    return "localhost" in lowered or "127.0.0.1" in lowered or "0.0.0.0" in lowered


class Settings(BaseSettings):
    """应用全局配置，所有字段都可被 .env 文件中的同名变量覆盖。"""

    deployment_mode: str = "local"

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

    # ---- LibreTranslate 免费翻译引擎 ----
    libre_translate_url: str = "http://localhost:5000"

    # ---- Redis 缓存连接 ----
    redis_url: str = "redis://localhost:6379/0"

    # ---- 应用运行配置 ----
    cors_origins: str = "http://localhost:3000,chrome-extension://*"  # 允许跨域的前端地址
    debug: bool = False  # 生产默认关闭，开发时在 .env 中设 DEBUG=true
    rate_limit_per_minute: int = 30  # 每分钟最大请求次数（per IP）

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    free_daily_page_translations: int = 10   # 每日免费整页翻译次数
    free_daily_text_translations: int = 100  # 每日免费文本翻译次数

    # ---- 数据库 ----
    database_url: str = Field(
        default="postgresql+asyncpg://translate:translate_dev@localhost:5432/translate_db",
        min_length=1,
    )

    # ---- JWT 认证 ----
    jwt_secret_key: str = "change-me-in-production-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7  # access_token 有效期（天）

    # ---- 简易认证 ----
    api_secret_key: str = ""  # 设置后所有翻译接口需携带 X-API-Key 头

    # 直接使用绝对路径定位项目根目录 .env，避免因启动工作目录不同而读错配置。
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_security_defaults(self):
        allowed_modes = {"local", "docker_host_nginx", "managed"}
        if self.deployment_mode not in allowed_modes:
            raise ValueError(
                f"DEPLOYMENT_MODE 必须是 {', '.join(sorted(allowed_modes))} 之一"
            )

        if not self.debug and self.jwt_secret_key == "change-me-in-production-use-a-long-random-string":
            raise ValueError(
                "生产环境必须显式设置 JWT_SECRET_KEY"
            )
        if not self.database_url.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL 必须使用 PostgreSQL asyncpg 连接串")

        if self.deployment_mode != "local":
            invalid_service_urls = {
                "REDIS_URL": self.redis_url,
                "DATABASE_URL": self.database_url,
                "LIBRE_TRANSLATE_URL": self.libre_translate_url,
            }
            for env_name, value in invalid_service_urls.items():
                if _uses_localhost(value):
                    raise ValueError(
                        f"{env_name} 不能在 {self.deployment_mode} 模式下使用 localhost/127.0.0.1/0.0.0.0"
                    )

            local_origins = [
                origin
                for origin in self.cors_origins.split(",")
                if origin.strip() and _is_local_origin(origin.strip())
            ]
            if local_origins:
                raise ValueError(
                    "生产部署时 CORS_ORIGINS 不能包含本地地址: " + ", ".join(local_origins)
                )

        return self


@lru_cache
def get_settings() -> Settings:
    """获取全局配置单例。整个应用生命周期内只会创建一次 Settings 实例。"""
    return Settings()
