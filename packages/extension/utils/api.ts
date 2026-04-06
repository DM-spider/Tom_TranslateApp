export interface TranslateParams {
  text: string;
  targetLang: string;
  engine: string;
  apiUrl: string;
  apiKey?: string;
  authToken?: string;
}

export interface TranslateBatchParams {
  texts: string[];
  targetLang: string;
  engine: string;
  apiUrl: string;
  apiKey?: string;
  authToken?: string;
}

export interface TranslateApiResult {
  translatedTexts: string[];
  sourceLang: string;
  engineUsed: string;
  tokensUsed: number | null;
}

const REQUEST_TIMEOUT_MS = 30_000;

async function callTranslateApi(
  apiUrl: string,
  body: { texts: string[]; source_lang: string; target_lang: string; engine: string },
  apiKey?: string,
  authToken?: string
): Promise<TranslateApiResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/v1/translate`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("翻译请求超时（30s），请稍后重试");
    }
    throw new Error("网络连接失败，请检查后端服务是否启动");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    let errorMsg = `翻译请求失败 (${res.status})`;
    if (data?.detail) {
      errorMsg =
        typeof data.detail === "string"
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join("; ")
            : JSON.stringify(data.detail);
    }
    throw new Error(errorMsg);
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
  return callTranslateApi(
    params.apiUrl,
    {
      texts: [params.text],
      source_lang: "auto",
      target_lang: params.targetLang,
      engine: params.engine,
    },
    params.apiKey,
    params.authToken,
  );
}

export async function translateBatch(
  params: TranslateBatchParams
): Promise<TranslateApiResult> {
  return callTranslateApi(
    params.apiUrl,
    {
      texts: params.texts,
      source_lang: "auto",
      target_lang: params.targetLang,
      engine: params.engine,
    },
    params.apiKey,
    params.authToken,
  );
}
