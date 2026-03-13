export type EngineType = "deepseek" | "gemini" | "baidu";

export type LangCode =
  | "auto"
  | "zh-CN"
  | "en"
  | "ja"
  | "ko"
  | "fr"
  | "de"
  | "es"
  | "ru";

export interface TranslateRequest {
  texts: string[];
  sourceLang: string;
  targetLang: string;
  engine: EngineType;
}

export interface TranslateResult {
  translatedTexts: string[];
  sourceLang: string;
  engineUsed: string;
  tokensUsed: number | null;
}
