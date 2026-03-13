---
name: TranslateApp 后续开发
overview: 后端 MVP 已基本完成（DeepSeek + Gemini 引擎、Redis 缓存、翻译 API），接下来需要：(1) 修补后端遗留问题，(2) 搭建 Next.js 网页前端，(3) 后续推进浏览器扩展开发。
todos:
  - id: backend-fix
    content: 后端查漏补缺：修复 gemini_model 默认值不一致、添加百度引擎未实现的错误防护、增强路由层错误处理
    status: completed
  - id: frontend-init
    content: 初始化 Next.js 项目：在 packages/ 下创建 web 项目，安装 React Query + lucide-react 依赖
    status: completed
  - id: frontend-api
    content: 实现 API 通信层 (src/lib/api.ts)：封装 translate 和 getLanguages 请求，处理命名风格转换
    status: completed
  - id: frontend-ui
    content: 实现主页面 UI：TranslatePanel 双栏布局、LanguageSelect 下拉菜单、EngineSwitch 引擎切换、ActionButtons 操作按钮
    status: completed
  - id: frontend-integration
    content: 前后端联调：React Query 集成、防抖输入、加载状态、错误处理、验证全流程通畅
    status: completed
  - id: shared-types
    content: 完善 shared 共享类型定义：EngineType、LangCode、消息类型等
    status: completed
  - id: manual-update
    content: 更新执行手册：补充 Gemini 引擎说明、前端环境变量配置、Dockerfile 内容
    status: completed
isProject: false
---

# TranslateApp 后续开发执行计划

## 当前项目状态

**已完成（后端 MVP）：**

- FastAPI 应用入口 + CORS + 健康检查
- DeepSeek / Gemini 两个翻译引擎
- Redis 翻译缓存（SHA-256 哈希键、7 天 TTL、批量查询）
- 翻译调度层（缓存优先 + 引擎选择）
- `POST /api/v1/translate` 和 `GET /api/v1/languages` 接口

**未完成（按优先级排列）：**

1. 后端小问题修补（配置不一致、百度引擎缺失防护、错误处理）
2. 网页前端（Next.js）— 执行手册第 3 步
3. shared 共享类型定义
4. 浏览器扩展（WXT）— 执行手册第 4 步
5. 后端 Dockerfile + 部署配置

---

## 阶段一：后端查漏补缺（0.5 天）

### 1.1 修复配置不一致

[config.py](Tom_TranslateApp/packages/backend/app/config.py) 第 28 行 `gemini_model` 默认值为 `gemini-2.5-flash`，而 [.env.example](Tom_TranslateApp/.env.example) 第 8 行为 `gemini-2.0-flash`，需统一。

### 1.2 防护百度引擎未实现的报错

当前 [translator.py](Tom_TranslateApp/packages/backend/app/services/translator.py) 第 46 行 `self.engines[req.engine]` 在选择 `engine=baidu` 时会抛出 `KeyError`。需在路由层或调度层添加明确的错误提示：

```python
engine = self.engines.get(req.engine)
if engine is None:
    raise ValueError(f"Engine '{req.engine}' is not yet implemented")
```

### 1.3 增强错误处理

[translate.py](Tom_TranslateApp/packages/backend/app/routers/translate.py) 第 60-63 行当前用一个泛 `Exception` 捕获所有异常。应区分：

- `ValueError`（参数错误）-> 400
- `KeyError`（引擎不存在）-> 400
- Redis 连接失败 -> 503
- 引擎 API 调用失败 -> 502

---

## 阶段二：搭建网页前端（3-5 天） — 核心工作

按执行手册第 3 步，使用 Next.js 14 + Tailwind CSS + React Query。

### 2.1 初始化 Next.js 项目

在 `packages/` 目录下创建 `web` 项目：

```bash
cd packages
pnpm create next-app web --typescript --tailwind --eslint --app --src-dir
cd web
pnpm add @tanstack/react-query lucide-react
```

### 2.2 前端核心文件结构

```
packages/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 根布局，挂载 QueryClientProvider
│   │   ├── page.tsx            # 主页面（翻译工具 UI）
│   │   └── globals.css         # Tailwind 全局样式
│   ├── components/
│   │   ├── TranslatePanel.tsx  # 翻译主面板（左右双栏）
│   │   ├── LanguageSelect.tsx  # 语言选择下拉菜单
│   │   ├── EngineSwitch.tsx    # 引擎切换组件
│   │   └── ActionButtons.tsx   # 操作按钮（复制、清空、交换语言）
│   ├── lib/
│   │   ├── api.ts              # 后端 API 通信层
│   │   └── types.ts            # 请求/响应类型定义
│   └── providers/
│       └── QueryProvider.tsx   # React Query Provider 封装
├── .env.local                  # NEXT_PUBLIC_API_URL=http://localhost:8000
└── next.config.ts
```

### 2.3 API 通信层 (`src/lib/api.ts`)

封装后端请求，处理驼峰/下划线命名转换：

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface TranslateRequest {
  texts: string[];
  sourceLang: string;
  targetLang: string;
  engine: string;
}

export interface TranslateResult {
  translatedTexts: string[];
  sourceLang: string;
  engineUsed: string;
  tokensUsed: number | null;
}

export async function translate(req: TranslateRequest): Promise<TranslateResult> {
  const res = await fetch(`${API_BASE}/api/v1/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      texts: req.texts,
      source_lang: req.sourceLang,
      target_lang: req.targetLang,
      engine: req.engine,
    }),
  });
  if (!res.ok) throw new Error(`Translation failed: ${res.status}`);
  const data = await res.json();
  return {
    translatedTexts: data.translated_texts,
    sourceLang: data.source_lang,
    engineUsed: data.engine_used,
    tokensUsed: data.tokens_used,
  };
}

export async function getLanguages(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/v1/languages`);
  if (!res.ok) throw new Error('Failed to fetch languages');
  return res.json();
}
```

### 2.4 主页面 UI 布局

参照执行手册 3.2 节，实现单页翻译工具：

```
+--------------------------------------------------+
|  [DeepSeek]  [Gemini]  [百度]    引擎切换区       |
+--------------------------------------------------+
|  源语言: [自动检测 v]  |  目标语言: [中文 v]      |
|  +------------------+  |  +------------------+   |
|  |                  |  |  |                  |   |
|  |   输入文本框     | [⇄] |   翻译结果展示   |   |
|  |                  |  |  |                  |   |
|  +------------------+  |  +------------------+   |
|  [清空]                |  [复制]                  |
+--------------------------------------------------+
|  Token 消耗: 125  |  引擎: deepseek              |
+--------------------------------------------------+
```

核心交互：

- 输入框支持防抖（500ms），自动触发翻译
- 翻译过程中显示加载骨架屏
- 错误状态红色提示
- 交换语言按钮同时交换输入/输出文本

### 2.5 React Query 集成

使用 `useMutation` 处理翻译请求（非标准 query，因为是用户主动触发的 POST）：

```typescript
const translateMutation = useMutation({
  mutationFn: translate,
  onError: (error) => setError(error.message),
});
```

使用 `useQuery` 获取语言列表（页面加载时自动获取，可缓存）：

```typescript
const { data: languages } = useQuery({
  queryKey: ['languages'],
  queryFn: getLanguages,
  staleTime: Infinity,
});
```

---

## 阶段三：完善 shared 共享类型（0.5 天）

[shared/src/index.ts](Tom_TranslateApp/shared/src/index.ts) 当前为空。需要定义前端和未来浏览器扩展共用的类型：

```typescript
// 翻译引擎类型
export type EngineType = 'deepseek' | 'gemini' | 'baidu';

// 支持的语言代码
export type LangCode = 'auto' | 'zh-CN' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'ru';

// 翻译请求/响应类型（前端 + 扩展共用）
export interface TranslateRequest { ... }
export interface TranslateResult { ... }

// 浏览器扩展通信消息类型（第 4 步用）
export type MessageType = 'TRANSLATE_SELECTION' | 'TRANSLATE_PAGE' | ...;
```

---

## 阶段四：浏览器扩展开发（后续，1-3 周）

按执行手册第 4 步，使用 WXT 框架。建议在网页前端联调通过后再开始。

初始化命令：

```bash
cd packages
pnpm dlx wxt@latest init extension
cd extension
pnpm add -D tailwindcss @tailwindcss/vite
```

开发顺序：划词翻译（1 周） -> 整页翻译（2 周）

---

## 执行手册建议补充

当前执行手册可以补充以下内容：

- Gemini 引擎相关说明（手册中只提到 DeepSeek + 百度，实际已实现 Gemini）
- 后端 Dockerfile 的具体内容（手册提到但未给出）
- 前端环境变量配置说明（`.env.local` 文件）

