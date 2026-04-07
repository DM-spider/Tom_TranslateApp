const LOCAL_API_BASE = "http://localhost:8000";

export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (value) {
    return value.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return LOCAL_API_BASE;
  }

  throw new Error("NEXT_PUBLIC_API_URL 未配置，生产环境不会再回退到 localhost");
}