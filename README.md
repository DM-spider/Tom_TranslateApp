# Tom_TranslateApp

AI 驱动的翻译工具，支持网页版 + 浏览器扩展。

## 生产部署约定

- VPS 默认只部署后端 API 与 Redis，宿主机 Nginx 负责 80/443 和证书。
- Docker Compose 生产配置使用 [deploy/docker-compose.prod.yml](deploy/docker-compose.prod.yml)，API 仅绑定到 127.0.0.1:8000，不再直接抢占 443。
- 宿主机 Nginx 参考 [deploy/nginx/default.conf](deploy/nginx/default.conf) 反向代理到 127.0.0.1:8000。
- 本地开发用 [.env.example](.env.example)，服务器用 [.env.production.example](.env.production.example)。
- 网页前端生产环境必须显式配置 NEXT_PUBLIC_API_URL；浏览器扩展发布版默认指向 https://api.tomtranslate.com。

## 技术栈

- **后端**: Python 3.11+ / FastAPI / Redis
- **网页前端**: Next.js / TypeScript / Tailwind CSS
- **浏览器扩展**: WXT / React / TypeScript
- **翻译引擎**: DeepSeek / OpenAI / 百度翻译

## 快速开始

1. 复制环境变量模板并填入你的 API Keys：
   cp .env.example .env
   