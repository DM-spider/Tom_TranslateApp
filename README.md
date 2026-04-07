# Tom_TranslateApp

AI 驱动的翻译工具，支持网页版 + 浏览器扩展。

## 技术栈

- **后端**: Python 3.11+ / FastAPI / Redis / PostgreSQL
- **网页前端**: Next.js / TypeScript / Tailwind CSS
- **浏览器扩展**: WXT / React / TypeScript
- **翻译引擎**: DeepSeek / Gemini / LibreTranslate

## 部署架构

```
浏览器 → Nginx (宿主机, 443/80)
              ├── tomtranslate.com       → web 容器 (:3000)
              └── api.tomtranslate.com   → api 容器 (:8000) → redis / db / libretranslate
```

- 宿主机 Nginx 负责 SSL 和反向代理，一张多域名证书覆盖所有域名
- 所有服务通过 Docker Compose 运行，端口仅绑定 127.0.0.1
- 前后端分离：`tomtranslate.com` 为前端，`api.tomtranslate.com` 为后端

## 服务器部署

```bash
# 1. 克隆项目
cd /root
git clone <repo-url> Tom_TranslateApp
cd Tom_TranslateApp

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入真实的 API Keys、JWT_SECRET_KEY、数据库密码等

# 3. 申请 SSL 证书（一张证书覆盖所有域名）
certbot --nginx -d tomtranslate.com -d www.tomtranslate.com -d api.tomtranslate.com

# 4. 配置 Nginx（宿主机）
cp deploy/nginx/default.conf /etc/nginx/conf.d/tomtranslate.conf
nginx -t && systemctl reload nginx

# 5. 启动所有服务
docker compose -f deploy/docker-compose.prod.yml build
docker compose -f deploy/docker-compose.prod.yml up -d

# 6. 验证
curl http://localhost:8000/health        # → {"status":"ok"}
curl -I http://localhost:3000            # → HTTP/1.1 200 OK
curl -I https://tomtranslate.com         # → 前端页面
curl https://api.tomtranslate.com/health # → 后端健康检查
```

## 版本更新

```bash
cd /root/Tom_TranslateApp
git pull
docker compose -f deploy/docker-compose.prod.yml build --no-cache
docker compose -f deploy/docker-compose.prod.yml up -d
```

## 数据库迁移

```bash
docker compose -f deploy/docker-compose.prod.yml exec api alembic upgrade head
```
