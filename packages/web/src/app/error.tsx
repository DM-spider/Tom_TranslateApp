"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error Boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-red-500">页面运行异常</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">应用遇到一个错误</h1>
        <p className="mt-2 text-sm text-gray-600">
          这通常是临时问题。你可以先点击“重试”，如果仍然失败请刷新页面。
        </p>

        <div className="mt-5 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
          {error.message || "Unknown error"}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            重试
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            刷新页面
          </button>
        </div>
      </div>
    </main>
  );
}
