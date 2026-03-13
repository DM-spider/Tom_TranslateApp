import { Languages } from "lucide-react";
import { TranslatePanel } from "@/components/TranslatePanel";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-12">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Languages className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Tom Translate
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          多引擎智能翻译 — DeepSeek / Gemini 驱动
        </p>
      </div>

      {/* 翻译面板 */}
      <TranslatePanel />

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-gray-400">
        <p>支持自动语言检测 | 翻译结果缓存 7 天 | 多引擎切换</p>
      </footer>
    </main>
  );
}
