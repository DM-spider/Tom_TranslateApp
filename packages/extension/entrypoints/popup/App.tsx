import { useState, useEffect, useCallback } from "react";
import type { EngineType, LangCode, ExtensionMessage } from "shared";
import type { ExtensionSettings, DisplayMode } from "@/utils/settings";

const ENGINES: { id: EngineType; label: string }[] = [
  { id: "deepseek", label: "DeepSeek" },
  { id: "gemini", label: "Gemini" },
];

const DISPLAY_MODES: { id: DisplayMode; label: string }[] = [
  { id: "bilingual", label: "对照翻译" },
  { id: "target-only", label: "仅译文" },
];

const LANGUAGES: { code: Exclude<LangCode, "auto">; name: string }[] = [
  { code: "zh-CN", name: "简体中文" },
  { code: "zh-TW", name: "繁體中文" },
  { code: "en", name: "English" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "ru", name: "Русский" },
];

type PageState = "idle" | "translating" | "done";

export default function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pageState, setPageState] = useState<PageState>("idle");
  const [hasTranslations, setHasTranslations] = useState(false);
  const [tab, setTab] = useState<"actions" | "settings">("actions");

  const queryPageState = useCallback(async () => {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab?.id) return;
      const res = await chrome.tabs.sendMessage(activeTab.id, {
        type: "GET_PAGE_STATE",
        payload: null,
      });
      if (res?.type === "PAGE_STATE") {
        setPageState(res.payload.state);
        setHasTranslations(res.payload.hasTranslations);
      }
    } catch {
      // content script 未注入
    }
  }, []);

  useEffect(() => {
    const msg: ExtensionMessage = { type: "GET_SETTINGS", payload: null };
    chrome.runtime.sendMessage(msg).then((res) => {
      if (res?.type === "SETTINGS") {
        setSettings(res.payload as ExtensionSettings);
      }
    });
    queryPageState();
  }, [queryPageState]);

  function updateSettings(next: ExtensionSettings) {
    setSettings(next);
    setDirty(true);
  }

  useEffect(() => {
    if (!settings || !dirty) return;
    const timer = setTimeout(async () => {
      const msg: ExtensionMessage = { type: "SAVE_SETTINGS", payload: settings };
      await chrome.runtime.sendMessage(msg);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 300);
    return () => clearTimeout(timer);
  }, [settings, dirty]);

  async function saveSettingsImmediately() {
    if (!settings || !dirty) return;
    const msg: ExtensionMessage = { type: "SAVE_SETTINGS", payload: settings };
    await chrome.runtime.sendMessage(msg);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleTranslatePage() {
    try {
      await saveSettingsImmediately();
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab?.id) return;
      await chrome.tabs.sendMessage(activeTab.id, {
        type: "TRANSLATE_PAGE",
        payload: settings
          ? { displayMode: settings.displayMode }
          : null,
      });
      setPageState("translating");
      window.close();
    } catch (err) {
      console.warn("Failed to send translate page message:", err);
    }
  }

  async function handleRestorePage() {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!activeTab?.id) return;
      await chrome.tabs.sendMessage(activeTab.id, {
        type: "RESTORE_PAGE",
        payload: null,
      });
      setPageState("idle");
      setHasTranslations(false);
    } catch (err) {
      console.warn("Failed to send restore message:", err);
    }
  }

  if (!settings) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-4 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold text-white">
          译
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-800">
            Tom Translate
          </h1>
          <p className="text-xs text-gray-400">划词翻译 & 整页翻译</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-4">
        <button
          onClick={() => setTab("actions")}
          className={`flex-1 pb-2 text-sm font-medium transition-colors ${
            tab === "actions"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          翻译
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`flex-1 pb-2 text-sm font-medium transition-colors ${
            tab === "settings"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          设置
        </button>
      </div>

      {tab === "actions" ? (
        <div className="flex flex-col gap-3 p-4">
          {/* Display Mode Switch */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-gray-400">模式</span>
            <div className="flex flex-1 gap-1.5">
              {DISPLAY_MODES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() =>
                    updateSettings({ ...settings, displayMode: id })
                  }
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    settings.displayMode === id
                      ? "bg-blue-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-right text-[11px] text-gray-400">
            引擎请在「设置」页调整
          </p>

          {/* Translate Page Button */}
          <button
            onClick={handleTranslatePage}
            disabled={pageState === "translating"}
            className={`w-full rounded-lg py-3 text-sm font-medium text-white transition-colors ${
              pageState === "translating"
                ? "cursor-not-allowed bg-gray-400"
                : "bg-blue-500 hover:bg-blue-600 active:bg-blue-700"
            }`}
          >
            {pageState === "translating" ? "翻译中..." : "翻译此页"}
          </button>

          {/* Restore Button */}
          {hasTranslations && (
            <button
              onClick={handleRestorePage}
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              还原页面
            </button>
          )}

          {/* Shortcut Hint */}
          <p className="text-center text-xs text-gray-400">
            快捷键 <kbd className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[11px] font-mono">Alt+1</kbd> 翻译 / 还原页面
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {/* Engine */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">
              翻译引擎
            </label>
            <div className="flex gap-2">
              {ENGINES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() =>
                    updateSettings({ ...settings, defaultEngine: id })
                  }
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    settings.defaultEngine === id
                      ? "border-blue-500 bg-blue-50 text-blue-600"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Language */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">
              默认目标语言
            </label>
            <select
              value={settings.defaultTargetLang}
              onChange={(e) =>
                updateSettings({
                  ...settings,
                  defaultTargetLang: e.target.value as Exclude<LangCode, "auto">,
                })
              }
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {LANGUAGES.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* API URL */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">
              后端 API 地址
            </label>
            <input
              type="url"
              value={settings.apiUrl}
              onChange={(e) =>
                updateSettings({ ...settings, apiUrl: e.target.value })
              }
              placeholder="http://localhost:8000"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              部署后请改为生产环境地址
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">
              API Key（可选）
            </label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) =>
                updateSettings({ ...settings, apiKey: e.target.value })
              }
              placeholder="留空表示无需认证"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              后端设置了 API_SECRET_KEY 时需填写
            </p>
          </div>

          {/* Auto Translate */}
          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
            <span className="text-sm text-gray-700">选中文本自动翻译</span>
            <input
              type="checkbox"
              checked={settings.autoTranslate}
              onChange={(e) =>
                updateSettings({ ...settings, autoTranslate: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          {/* Auto-save indicator */}
          <div
            className={`text-center text-xs transition-opacity duration-300 ${
              saved ? "text-green-500 opacity-100" : "text-gray-400 opacity-60"
            }`}
          >
            {saved ? "已保存 ✓" : "修改后自动保存"}
          </div>
        </div>
      )}
    </div>
  );
}
