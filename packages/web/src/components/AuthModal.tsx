"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { login, register } from "@/lib/auth";

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        await register(email, password);
      } else {
        await login(email, password);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        {/* 标题 */}
        <h2 className="mb-1 text-xl font-semibold text-gray-800">
          {mode === "login" ? "登录" : "注册"}
        </h2>
        <p className="mb-6 text-sm text-gray-400">
          {mode === "login"
            ? "登录后可使用 AI 翻译引擎"
            : "创建账户，开始使用 AI 翻译"}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              邮箱
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              密码
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 个字符"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:bg-gray-300"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        {/* 切换模式 */}
        <p className="mt-4 text-center text-sm text-gray-400">
          {mode === "login" ? (
            <>
              还没有账户？{" "}
              <button
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className="font-medium text-blue-500 hover:text-blue-600"
              >
                注册
              </button>
            </>
          ) : (
            <>
              已有账户？{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="font-medium text-blue-500 hover:text-blue-600"
              >
                登录
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
