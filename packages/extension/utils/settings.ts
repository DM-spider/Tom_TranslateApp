import type { EngineType, LangCode } from "shared";

const SETTINGS_KEY = "tom-translate-settings";
const DEFAULT_API_URL = "https://api.tomtranslate.com";

export type DisplayMode = "bilingual" | "target-only";

export interface ExtensionSettings {
  defaultEngine: EngineType;
  defaultTargetLang: Exclude<LangCode, "auto">;
  autoTranslate: boolean;
  apiUrl: string;
  apiKey: string;
  displayMode: DisplayMode;
  authToken: string;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultEngine: "libre",
  defaultTargetLang: "zh-CN",
  autoTranslate: true,
  apiUrl: DEFAULT_API_URL,
  apiKey: "",
  displayMode: "bilingual",
  authToken: "",
};

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const merged = { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] || {}) };
  if (!merged.apiUrl || !merged.apiUrl.startsWith("http")) {
    merged.apiUrl = DEFAULT_SETTINGS.apiUrl;
  }
  return merged;
}

export async function saveSettings(
  partial: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
  return updated;
}
