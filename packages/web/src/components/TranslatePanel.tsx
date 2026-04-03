"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Copy, Trash2, Check, Loader2, Send } from "lucide-react";
import { translate, getLanguages } from "@/lib/api";
import type { EngineType } from "shared";
import { loadUserPreferences, saveUserPreferences } from "@/lib/storage";
import { LanguageSelect } from "./LanguageSelect";
import { EngineSwitch } from "./EngineSwitch";

const DEFAULT_LANGUAGES: Record<string, string> = {
  auto: "自动检测",
  "zh-CN": "中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  ru: "Русский",
};

const MAX_INPUT_CHARS = 5000;

export function TranslatePanel() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("zh-CN");
  const [engine, setEngine] = useState<EngineType>("libre");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: languages = DEFAULT_LANGUAGES } = useQuery({
    queryKey: ["languages"],
    queryFn: getLanguages,
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: translate,
    onSuccess: (result) => {
      setOutputText(result.translatedTexts.join("\n"));
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    const stored = loadUserPreferences();
    if (stored) {
      setSourceLang(stored.sourceLang);
      setTargetLang(stored.targetLang);
      setEngine(stored.engine);
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    saveUserPreferences({
      sourceLang,
      targetLang,
      engine,
    });
  }, [sourceLang, targetLang, engine, initialized]);

  const triggerTranslation = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setOutputText("");
        setError(null);
        return;
      }
      if (trimmed.length > MAX_INPUT_CHARS) {
        setOutputText("");
        setError(`输入内容过长，请控制在 ${MAX_INPUT_CHARS} 字符以内`);
        return;
      }

      mutation.mutate({
        texts: [trimmed],
        sourceLang,
        targetLang,
        engine,
      });
    },
    [sourceLang, targetLang, engine, mutation]
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setInputText(value);
      if (value.length > MAX_INPUT_CHARS) {
        setError(`输入内容过长，请控制在 ${MAX_INPUT_CHARS} 字符以内`);
      } else if (error?.includes("输入内容过长")) {
        setError(null);
      }
    },
    [error]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        triggerTranslation(inputText);
      }
    },
    [triggerTranslation, inputText]
  );

  const handleSwapLanguages = () => {
    if (sourceLang === "auto" || mutation.isPending) return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(outputText);
    setOutputText(inputText);
  };

  const handleClear = () => {
    if (mutation.isPending) return;
    setInputText("");
    setOutputText("");
    setError(null);
  };

  const handleCopy = async () => {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* 引擎切换 */}
      <div className="mb-6 flex justify-center">
        <EngineSwitch
          value={engine}
          onChange={setEngine}
          disabled={mutation.isPending}
        />
      </div>

      {/* 翻译面板 */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
        {/* 语言栏 */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4 border-b border-gray-100 px-6 py-4">
          <LanguageSelect
            value={sourceLang}
            onChange={setSourceLang}
            languages={languages}
            disabled={mutation.isPending}
            label="源语言"
          />
          <button
            onClick={handleSwapLanguages}
            disabled={sourceLang === "auto" || mutation.isPending}
            className="mb-0.5 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
            title="交换语言"
          >
            <ArrowRightLeft className="h-5 w-5" />
          </button>
          <LanguageSelect
            value={targetLang}
            onChange={setTargetLang}
            languages={languages}
            excludeAuto
            disabled={mutation.isPending}
            label="目标语言"
          />
        </div>

        {/* 文本区域 */}
        <div className="grid min-h-[280px] grid-cols-1 md:grid-cols-2 md:divide-x md:divide-gray-100">
          {/* 输入 */}
          <div className="relative flex flex-col p-4">
            <textarea
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入要翻译的文本... (Ctrl+Enter 翻译)"
              disabled={mutation.isPending}
              className="flex-1 resize-none border-none bg-transparent text-base leading-relaxed text-gray-800 placeholder-gray-300 focus:outline-none"
              rows={8}
            />
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-400">
                {inputText.length} / {MAX_INPUT_CHARS} 字符
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClear}
                  disabled={!inputText || mutation.isPending}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 disabled:opacity-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  清空
                </button>
                <button
                  onClick={() => triggerTranslation(inputText)}
                  disabled={!inputText.trim() || mutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  <Send className="h-3.5 w-3.5" />
                  翻译
                </button>
              </div>
            </div>
          </div>

          {/* 输出 */}
          <div className="relative flex flex-col border-t border-gray-100 bg-gray-50/50 p-4 md:border-t-0">
            {mutation.isPending && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              </div>
            )}
            <div className="flex-1 whitespace-pre-wrap text-base leading-relaxed text-gray-800">
              {outputText || (
                <span className="text-gray-300">翻译结果将在这里显示...</span>
              )}
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-400">
                {mutation.data?.engineUsed && (
                  <>
                    引擎: {mutation.data.engineUsed}
                    {mutation.data.tokensUsed != null &&
                      ` | Token: ${mutation.data.tokensUsed}`}
                  </>
                )}
              </span>
              <button
                onClick={handleCopy}
                disabled={!outputText || mutation.isPending}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-green-500">已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="border-t border-red-100 bg-red-50 px-6 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
