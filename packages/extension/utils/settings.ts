import type { EngineType, LangCode } from "shared";

const SETTINGS_KEY = "tom-translate-settings";

export interface ExtensionSettings {
  defaultEngine: EngineType;
  defaultTargetLang: Exclude<LangCode, "auto">;
  autoTranslate: boolean;
  apiUrl: string;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultEngine: "deepseek",
  defaultTargetLang: "zh-CN",
  autoTranslate: true,
  apiUrl: "http://localhost:8000",
};

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
}

export async function saveSettings(
  partial: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
  return updated;
}
