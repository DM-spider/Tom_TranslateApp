export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!value) {
    throw new Error("NEXT_PUBLIC_API_URL 未配置");
  }
  return value.replace(/\/$/, "");
}
