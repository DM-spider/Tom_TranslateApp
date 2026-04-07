import type { TranslateRequest, TranslateResult } from "shared";
import { authHeaders } from "./auth";
import { getApiBaseUrl } from "./env";

const API_BASE = getApiBaseUrl();
const REQUEST_TIMEOUT_MS = 15000;

async function parseErrorResponse(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await res
      .json()
      .catch(() => null as { detail?: string } | null);
    if (body?.detail) {
      return body.detail;
    }
  }

  const text = await res.text().catch(() => "");
  if (text.trim()) {
    return `翻译请求失败 (${res.status}): ${text.slice(0, 160)}`;
  }

  return `翻译请求失败 (${res.status})`;
}

export async function translate(
  req: TranslateRequest
): Promise<TranslateResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        texts: req.texts,
        source_lang: req.sourceLang,
        target_lang: req.targetLang,
        engine: req.engine,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("翻译请求超时，请稍后重试");
    }
    throw new Error("网络连接失败，请检查后端服务是否启动");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }

  const data = await res.json().catch(() => null);
  if (!data) {
    throw new Error("翻译服务返回了无法解析的数据");
  }

  return {
    translatedTexts: data.translated_texts,
    sourceLang: data.source_lang,
    engineUsed: data.engine_used,
    tokensUsed: data.tokens_used,
  };
}

export async function getLanguages(): Promise<Record<string, string>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;

  try {
    res = await fetch(`${API_BASE}/api/v1/languages`, {
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("获取语言列表超时");
    }
    throw new Error("获取语言列表失败，请检查网络连接");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }

  const data = await res.json().catch(() => null);
  if (!data) {
    throw new Error("语言列表返回格式错误");
  }

  return data;
}
