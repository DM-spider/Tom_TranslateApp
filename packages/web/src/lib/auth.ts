/**
 * 认证模块
 *
 * 职责：
 * - 管理 JWT token 的存储和读取（localStorage）
 * - 提供登录、注册、获取用户信息的 API 调用
 * - 请求拦截：自动在 fetch 中附带 Authorization 头
 */

import { getApiBaseUrl } from "./env";

const API_BASE = getApiBaseUrl();
const TOKEN_KEY = "tom-translate.auth.token";

// ---- Token 管理 ----

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ---- 请求辅助 ----

export function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ---- API 调用 ----

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface UserInfo {
  id: number;
  email: string;
  plan: string;
  today_llm_usage: number;
  daily_limit: number;
}

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  if (data?.detail) {
    return typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
  }
  return `请求失败 (${res.status})`;
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data: AuthResponse = await res.json();
  setToken(data.access_token);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data: AuthResponse = await res.json();
  setToken(data.access_token);
  return data;
}

export async function fetchMe(): Promise<UserInfo> {
  const token = getToken();
  if (!token) throw new Error("未登录");
  const res = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) {
      removeToken();
      throw new Error("登录已过期，请重新登录");
    }
    throw new Error(await parseError(res));
  }
  return res.json();
}

export function logout(): void {
  removeToken();
}
