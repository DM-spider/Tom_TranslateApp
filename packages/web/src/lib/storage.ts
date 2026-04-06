import type { EngineType } from "shared";

const PREFERENCES_KEY = "tom-translate.preferences.v1";

export interface UserPreferences {
  sourceLang: string;
  targetLang: string;
  engine: EngineType;
}

const VALID_ENGINES: EngineType[] = ["deepseek", "gemini", "baidu", "libre"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

export function loadUserPreferences(): UserPreferences | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }

    const sourceLang = parsed.sourceLang;
    const targetLang = parsed.targetLang;
    const engine = parsed.engine;

    if (
      typeof sourceLang !== "string" ||
      typeof targetLang !== "string" ||
      typeof engine !== "string"
    ) {
      return null;
    }

    if (!VALID_ENGINES.includes(engine as EngineType)) {
      return null;
    }

    return {
      sourceLang,
      targetLang,
      engine: engine as EngineType,
    };
  } catch {
    return null;
  }
}

export function saveUserPreferences(preferences: UserPreferences): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage errors (private mode or quota exceeded).
  }
}
