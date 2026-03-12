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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import translate

# 读取全局配置
settings = get_settings()

# 创建 FastAPI 应用实例
app = FastAPI(title="Tom Translate", version="0.1.0")

# 配置 CORS（跨域资源共享）中间件
# 作用：允许网页前端（localhost:3000）和浏览器扩展（chrome-extension://）跨域访问后端 API
# 如果不配置，浏览器会因为安全策略拦截前端对后端的请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),  # 从 .env 读取允许的来源列表
    allow_credentials=True,
    allow_methods=["*"],   # 允许所有 HTTP 方法（GET、POST 等）
    allow_headers=["*"],   # 允许所有请求头
)

# 注册翻译相关的路由（/api/v1/translate、/api/v1/languages）
app.include_router(translate.router)


@app.get("/health")
async def health():
    """健康检查接口，用于确认服务是否正常运行。部署监控时也会定期调用这个接口。"""
    return {"status": "ok"}
