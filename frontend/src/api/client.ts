import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import type { components } from "./schema";

type TokenResponse = components["schemas"]["TokenResponseDto"];

// The access token lives in memory only (FE-5): a page reload restores it through the HttpOnly refresh cookie.
let accessToken: string | null = null;
let onSessionExpired: () => void = () => {};

export const http = axios.create({ baseURL: "/api/v1", withCredentials: true, timeout: 15_000 });

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<TokenResponse> | null = null;

// Single flight: the refresh token rotates on every use, so two parallel refreshes would look like a replay
// to the API and revoke the session.
export function refreshSession(): Promise<TokenResponse> {
  refreshing ??= axios
    .post<TokenResponse>("/api/v1/auth/refresh", null, { withCredentials: true, timeout: 15_000 })
    .then((res) => {
      setAccessToken(res.data.access_token);
      return res.data;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

http.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (AxiosRequestConfig & { retried?: boolean }) | undefined;
  const isAuthCall = config?.url?.startsWith("/auth/");
  if (error.response?.status !== 401 || !config || config.retried || isAuthCall) throw error;

  try {
    await refreshSession();
  } catch {
    setAccessToken(null);
    onSessionExpired();
    throw error;
  }
  config.retried = true;
  return http(config);
});
