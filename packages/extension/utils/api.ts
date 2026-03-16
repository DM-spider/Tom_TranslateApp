export interface TranslateParams {
  text: string;
  targetLang: string;
  engine: string;
  apiUrl: string;
}

export interface TranslateBatchParams {
  texts: string[];
  targetLang: string;
  engine: string;
  apiUrl: string;
}

export interface TranslateApiResult {
  translatedTexts: string[];
  sourceLang: string;
  engineUsed: string;
  tokensUsed: number | null;
}

async function callTranslateApi(
  apiUrl: string,
  body: { texts: string[]; source_lang: string; target_lang: string; engine: string }
): Promise<TranslateApiResult> {
  const res = await fetch(`${apiUrl}/api/v1/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(
      (data as { detail?: string })?.detail || `翻译请求失败 (${res.status})`
    );
  }

  const data = await res.json();
  return {
    translatedTexts: data.translated_texts,
    sourceLang: data.source_lang,
    engineUsed: data.engine_used,
    tokensUsed: data.tokens_used,
  };
}

export async function translateText(
  params: TranslateParams
): Promise<TranslateApiResult> {
  return callTranslateApi(params.apiUrl, {
    texts: [params.text],
    source_lang: "auto",
    target_lang: params.targetLang,
    engine: params.engine,
  });
}

export async function translateBatch(
  params: TranslateBatchParams
): Promise<TranslateApiResult> {
  return callTranslateApi(params.apiUrl, {
    texts: params.texts,
    source_lang: "auto",
    target_lang: params.targetLang,
    engine: params.engine,
  });
}
