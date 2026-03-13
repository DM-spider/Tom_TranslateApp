import type { TranslateRequest, TranslateResult } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function translate(
  req: TranslateRequest
): Promise<TranslateResult> {
  const res = await fetch(`${API_BASE}/api/v1/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      texts: req.texts,
      source_lang: req.sourceLang,
      target_lang: req.targetLang,
      engine: req.engine,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `翻译请求失败 (${res.status})`);
  }

  const data = await res.json();
  return {
    translatedTexts: data.translated_texts,
    sourceLang: data.source_lang,
    engineUsed: data.engine_used,
    tokensUsed: data.tokens_used,
  };
}

export async function getLanguages(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/v1/languages`);
  if (!res.ok) {
    throw new Error("获取语言列表失败");
  }
  return res.json();
}
