import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiErrorBody, AuthResponse } from './types';

export const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30_000,
});

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a new access token. Concurrent
 * callers share one in-flight request.
 */
export function refreshSession(): Promise<string | null> {
  refreshing ??= axios
    .post<AuthResponse>('/api/auth/refresh', null, { withCredentials: true, timeout: 15_000 })
    .then(({ data }) => {
      useAuthStore.getState().setSession(data.accessToken, data.user);
      return data.accessToken;
    })
    .catch((error: unknown) => {
      if (isAxiosError(error) && error.response && error.response.status < 500) {
        useAuthStore.getState().clear();
      }
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthCall = AUTH_ENDPOINTS.some((path) => config?.url?.startsWith(path));
    if (error.response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      const token = await refreshSession();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        return http(config);
      }
    }
    return Promise.reject(error);
  },
);

export function isAxiosError(error: unknown): error is AxiosError<ApiErrorBody> {
  return axios.isAxiosError(error);
}

/** Human readable message for any error thrown by the API layer. */
export function getErrorMessage(error: unknown, fallback = 'Не удалось выполнить действие'): string {
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return 'Сервер не ответил вовремя. Повторите попытку';
    if (!error.response) return 'Нет соединения с сервером. Проверьте сеть';
    const message = error.response.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
    if (error.response.status === 403) return 'Недостаточно прав для этого действия';
    if (error.response.status >= 500) return 'Ошибка сервера. Повторите попытку позже';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function getErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? error.response?.data?.code : undefined;
}

/** Drops undefined / empty-string params so URLs stay clean. */
export function cleanParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Partial<T>;
}

export async function get<T>(url: string, params?: object, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<T>(url, { ...config, params: params ? cleanParams(params) : undefined });
  return data;
}

export async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.post<T>(url, body, config);
  return data;
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await http.patch<T>(url, body);
  return data;
}

export async function del<T = void>(url: string): Promise<T> {
  const { data } = await http.delete<T>(url);
  return data;
}

/** Downloads a binary file (Excel export) and saves it with the server-given name. */
export async function download(url: string, params: object, fallbackName: string): Promise<void> {
  let response;
  try {
    response = await http.get<Blob>(url, {
      params: cleanParams(params),
      responseType: 'blob',
      timeout: 120_000,
    });
  } catch (error) {
    // Error bodies arrive as Blob when responseType is 'blob'.
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        const body = JSON.parse(await error.response.data.text()) as ApiErrorBody;
        error.response.data = body as never;
      } catch {
        /* keep the original error */
      }
    }
    throw error;
  }
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match?.[1] ?? fallbackName;
  const href = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
