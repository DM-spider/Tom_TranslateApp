# FastAPI 运作机制详解

> 基于 Tom_TranslateApp 项目的实际代码，从零讲清楚 FastAPI 如何把本地 Python 代码变成网页可以访问的接口。

---

## 一、先建立一个直觉性的理解

你可以把 FastAPI 理解成一个 **"窗口服务员"**：

- 你的翻译逻辑（DeepSeek、Gemini 调用）是厨房，藏在后面，外人看不见
- FastAPI 是前台窗口，负责接收订单（HTTP 请求）、传给厨房、把餐品（翻译结果）端出来
- 前端页面（React）就是那个走进来的顾客，它只和窗口打交道，不需要知道厨房怎么运作

---

## 二、FastAPI 的完整请求链路

以本项目的一次翻译为例，全程走一遍：

```
用户在网页输入 "Hello"，点击翻译按钮
         │
         ▼
【前端 React】TranslatePanel.tsx
  调用 api.ts 中的 translate() 函数
         │
         ▼
【HTTP 请求】POST http://localhost:8000/api/v1/translate
  请求体（JSON）：
  {
    "texts": ["Hello"],
    "source_lang": "auto",
    "target_lang": "zh-CN",
    "engine": "deepseek"
  }
         │
         ▼
【Uvicorn】监听 8000 端口，接收到这个 HTTP 请求，转交给 FastAPI
         │
         ▼
【CORS 中间件】检查请求来源是否在白名单，通过后继续
         │
         ▼
【路由匹配】FastAPI 扫描所有已注册的路由，发现：
  "POST /api/v1/translate" → translate() 函数
         │
         ▼
【数据验证】Pydantic 自动把 JSON 解析为 TranslateRequest 对象
  如果字段缺失/类型错误，直接返回 422 错误，连函数都不会进
         │
         ▼
【路由函数执行】translate.py 中的 async def translate(req)
  调用 TranslatorService.translate(req)
         │
         ▼
【业务逻辑】translator.py → 查缓存 → 调用 DeepSeek API → 写缓存
         │
         ▼
【返回结果】TranslateResult 对象自动序列化为 JSON
  {
    "translated_texts": ["你好"],
    "source_lang": "auto",
    "engine_used": "deepseek",
    "tokens_used": 50
  }
         │
         ▼
【前端收到响应】api.ts 解析 JSON，更新页面显示
```

---

## 三、核心机制逐一拆解

### 3.1 uvicorn：让 Python 程序变成一个服务器

FastAPI 本身只是一个 Python 对象，它自己不会监听网络端口。**uvicorn** 是真正的 HTTP 服务器，负责：

1. 绑定到本机的 8000 端口，持续监听
2. 收到 HTTP 请求时，转成 Python 能理解的格式
3. 把请求交给 FastAPI 的 `app` 对象处理
4. 把 Python 返回的结果转回 HTTP 响应，发给请求方

启动命令：
```bash
uv run uvicorn app.main:app --reload --port 8000
#                 ^^^^^^^^  这里的 app 就是 main.py 里 app = FastAPI() 创建的那个对象
```

**类比**：uvicorn 是快递站，FastAPI 是分拣员。快递站负责收包裹、发包裹，分拣员负责根据地址把包裹送到对的地方。

---

### 3.2 路由（Router）：快递地址系统

路由定义了"什么 URL + 什么方法 → 执行什么函数"的映射关系。

```python
# routers/translate.py

router = APIRouter(prefix="/api/v1", tags=["translate"])

@router.post("/translate", response_model=TranslateResult)
async def translate(req: TranslateRequest):
    ...
```

这里发生了三件事：

| 部分 | 代码 | 含义 |
|------|------|------|
| HTTP 方法 | `@router.post` | 只响应 POST 请求（GET 请求会被拒绝） |
| URL 路径 | `prefix="/api/v1"` + `"/translate"` | 完整路径 = `/api/v1/translate` |
| 绑定函数 | `async def translate(req)` | 收到请求后执行这个函数 |

在 `main.py` 中，通过 `include_router` 把路由器挂载到主应用：

```python
# main.py
app.include_router(translate.router)
# 效果：translate.router 里定义的所有路由，都挂载到 app 上生效
```

---

### 3.3 Pydantic：自动的数据验证与转换

这是 FastAPI 最省力的特性之一。你只需要定义数据结构，FastAPI 自动完成 JSON ↔ Python 对象的双向转换，并在不合法时返回详细的错误信息。

```python
# engines/base.py

class TranslateRequest(BaseModel):
    texts: list[str]          # 必填，字符串列表
    source_lang: str = "auto" # 选填，默认 "auto"
    target_lang: str = "zh-CN"
    engine: EngineType = EngineType.DEEPSEEK
```

当前端发送这个 JSON：
```json
{
  "texts": ["Hello"],
  "target_lang": "zh-CN",
  "engine": "deepseek"
}
```

FastAPI 自动做了这些事：
1. 把 JSON 字符串解析成 Python 字典
2. 按 `TranslateRequest` 的字段定义逐一赋值
3. `source_lang` 没传？自动填默认值 `"auto"`
4. `engine` 传的是字符串 `"deepseek"`？自动转换成 `EngineType.DEEPSEEK` 枚举值
5. 如果 `texts` 传了个数字而不是列表？直接返回 `422 Unprocessable Entity` 错误

路由函数拿到的 `req` 参数，已经是完整校验过的 `TranslateRequest` 对象，不需要手写任何解析代码。

---

### 3.4 CORS 中间件：解决"浏览器安全策略"问题

浏览器有一个安全规则：**不允许网页向不同源（域名/端口）发请求**。

本项目中：
- 前端跑在 `http://localhost:3000`（Next.js）
- 后端跑在 `http://localhost:8000`（FastAPI）

端口不同 = 不同源，浏览器默认会拦截前端对后端的请求。

CORS 中间件的作用是在 HTTP 响应中加一个头：
```
Access-Control-Allow-Origin: http://localhost:3000
```

浏览器看到这个头，就知道"后端授权了这个来源"，放行请求。

```python
# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),  # 读取 .env 里的白名单
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**注意**：这个检查是浏览器做的，不是服务器。用 Postman 或 curl 直接调接口，CORS 完全没有影响。

---

### 3.5 async/await：高并发的关键

FastAPI 的路由函数都使用 `async def`：

```python
@router.post("/translate")
async def translate(req: TranslateRequest):
    return await translator.translate(req)
```

这意味着：当这个请求在等待 DeepSeek API 响应时（可能需要 2-5 秒），Python 不会傻等——它会去处理其他请求，等 DeepSeek 回来了再回来继续。

**类比**：服务员点完菜去厨房下单后，不站在那里等菜好，而是去服务下一桌顾客。菜好了厨房喊一声，服务员再过来端菜。

---

## 四、`/docs` 页面是怎么来的

FastAPI 会自动扫描所有路由和 Pydantic 模型，生成一个交互式 API 文档。

访问 `http://localhost:8000/docs`，你看到的界面是 **Swagger UI**，完全由 FastAPI 自动生成，无需任何额外配置。

你可以在这个页面直接测试接口（输入参数、点击 Execute、看响应），这是调试后端的最快方式，不需要写任何前端代码。

---

## 五、本项目的完整代码层级

```
HTTP 请求
    │
    ▼
main.py          ← 应用入口，配置中间件，注册路由
    │
    ▼
routers/
  translate.py   ← 定义 URL 路径，接收/返回数据，异常处理
    │
    ▼
services/
  translator.py  ← 业务调度：缓存查询 + 引擎选择
    │
    ├── cache.py           ← Redis 缓存读写
    │
    └── engines/
          base.py          ← 数据结构定义（TranslateRequest/Result）
          deepseek.py      ← 调用 DeepSeek API
          gemini.py        ← 调用 Gemini API
```

每一层只做自己的事，不越界。路由层不管缓存，缓存层不管引擎，引擎层不管路由——这就是"关注点分离"，也是 FastAPI 项目的标准组织方式。

---

## 六、一句话总结

> FastAPI = **路由表**（URL → 函数的映射）+ **Pydantic**（自动数据校验）+ **uvicorn**（HTTP 服务器）三者的组合。你写的 Python 函数通过装饰器 `@router.post("/path")` 标记一下，FastAPI 就把它变成了一个可以被网络访问的 HTTP 接口。
