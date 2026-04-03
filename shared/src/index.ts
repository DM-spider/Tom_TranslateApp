// ========== 翻译引擎类型 ==========

export type EngineType = "deepseek" | "gemini" | "libre" | "baidu";

// ========== 语言代码 ==========

export type LangCode =
  | "auto"
  | "zh-CN"
  | "zh-TW"
  | "en"
  | "ja"
  | "ko"
  | "fr"
  | "de"
  | "es"
  | "ru";

// ========== 翻译请求 / 响应 ==========

export interface TranslateRequest {
  texts: string[];
  sourceLang: LangCode | string;
  targetLang: Exclude<LangCode, "auto"> | string;
  engine: EngineType;
}

export interface TranslateResult {
  translatedTexts: string[];
  sourceLang: string;
  engineUsed: string;
  tokensUsed: number | null;
}

// ========== 浏览器扩展通信协议 ==========

export type ExtensionMessageType =
  | "TRANSLATE_SELECTION"
  | "TRANSLATE_PAGE"
  | "TRANSLATE_BATCH"
  | "GET_SETTINGS"
  | "SAVE_SETTINGS";

export type ExtensionResponseType =
  | "TRANSLATE_RESULT"
  | "SETTINGS"
  | "ERROR";

export interface ExtensionMessage<T = unknown> {
  type: ExtensionMessageType;
  payload: T;
}

export interface ExtensionResponse<T = unknown> {
  type: ExtensionResponseType;
  payload: T;
}

// ========== 用户设置 ==========

export interface UserSettings {
  defaultEngine: EngineType;
  defaultTargetLang: Exclude<LangCode, "auto">;
  autoTranslate: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultEngine: "libre",
  defaultTargetLang: "zh-CN",
  autoTranslate: true,
};
