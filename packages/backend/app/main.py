"""
FastAPI 应用入口

职责：创建 FastAPI 应用实例，配置中间件，注册路由。
这是整个后端的"总开关"，uvicorn 启动时加载的就是这个文件中的 app 对象。

启动命令：
  uv run uvicorn app.main:app --reload --port 8000

启动后可访问：
  http://localhost:8000/health  — 健康检查（确认服务是否在运行）
  http://localhost:8000/docs    — 自动生成的交互式 API 文档（可以直接在网页上测试接口）
"""

import time
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings
from app.routers import translate, auth
from app.database import init_db, close_db

settings = get_settings()
cors_origin_values = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
cors_allow_origins = [o for o in cors_origin_values if "*" not in o]
cors_allow_origin_regex = None

if any(origin == "chrome-extension://*" for origin in cors_origin_values):
    cors_allow_origin_regex = r"^chrome-extension://[a-z]{32}$"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    try:
        yield
    finally:
        await close_db()

app = FastAPI(
    title="Tom Translate",
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan,
)


# ---- 速率限制中间件（滑动窗口，per IP） ----

class RateLimitMiddleware(BaseHTTPMiddleware):
    """基于 IP 的滑动窗口速率限制，仅对 /api/ 路径生效。"""

    def __init__(self, app, max_requests: int, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        timestamps = self._hits[client_ip]

        # 清除窗口外的旧记录
        cutoff = now - self.window
        self._hits[client_ip] = [t for t in timestamps if t > cutoff]
        timestamps = self._hits[client_ip]

        if len(timestamps) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"请求过于频繁，每分钟最多 {self.max_requests} 次，请稍后重试",
            )

        timestamps.append(now)
        return await call_next(request)


# ---- API Key 认证中间件 ----

class ApiKeyMiddleware(BaseHTTPMiddleware):
    """当 .env 配置了 API_SECRET_KEY 时，翻译接口需携带 X-API-Key 头。"""

    def __init__(self, app, secret_key: str):
        super().__init__(app)
        self.secret_key = secret_key

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/v1/translate"):
            provided = request.headers.get("X-API-Key", "")
            if provided != self.secret_key:
                raise HTTPException(status_code=401, detail="缺少或无效的 API Key")
        return await call_next(request)


# ---- 注册中间件（注意顺序：后注册的先执行） ----

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_origin_regex=cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key", "Authorization"],
)

app.add_middleware(RateLimitMiddleware, max_requests=settings.rate_limit_per_minute)

if settings.api_secret_key:
    app.add_middleware(ApiKeyMiddleware, secret_key=settings.api_secret_key)

app.include_router(translate.router)
app.include_router(auth.router)


@app.get("/health")
async def health():
    """健康检查接口，用于确认服务是否正常运行。部署监控时也会定期调用这个接口。"""
    return {"status": "ok"}
