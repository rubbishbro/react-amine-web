import { buildApiUrl } from '../pages/config/api.js';

const CSRF_COOKIE = 'aw_csrf_token';
let refreshPromise = null;

const readCookie = (name) => {
  if (typeof document === 'undefined') return '';
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split('; ').find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : '';
};

const responseMessage = async (response) => {
  try {
    const data = await response.clone().json();
    if (typeof data === 'string') return data;
    if (Array.isArray(data?.detail)) return data.detail[0]?.msg || '';
    return data?.detail || data?.message || '';
  } catch {
    return '';
  }
};

export class ApiError extends Error {
  constructor(message, response) {
    super(message);
    this.name = 'ApiError';
    this.status = response?.status || 0;
    this.requestId = response?.headers?.get('x-request-id') || '';
    this.retryAfter = Number(response?.headers?.get('retry-after') || 0);
  }
}

const isUnsafe = (method) => !['GET', 'HEAD', 'OPTIONS'].includes(method);

const doRefresh = async () => {
  if (!refreshPromise) {
    const performRefresh = async () => {
      const headers = {};
      const csrf = readCookie(CSRF_COOKIE);
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const response = await fetch(buildApiUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        throw new ApiError(await responseMessage(response) || '登录状态已过期', response);
      }
      return response;
    };
    const coordinatedRefresh = (
      typeof navigator !== 'undefined' && navigator.locks?.request
        ? navigator.locks.request('aw-session-refresh', performRefresh)
        : performRefresh()
    );
    refreshPromise = coordinatedRefresh.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export async function apiFetch(pathOrUrl, init = {}, options = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : buildApiUrl(pathOrUrl);
  const method = (init.method || 'GET').toUpperCase();

  const execute = () => {
    const headers = new Headers(init.headers || {});
    if (isUnsafe(method) && !headers.has('Authorization')) {
      const csrf = readCookie(CSRF_COOKIE);
      if (csrf) headers.set('X-CSRF-Token', csrf);
    }
    return fetch(url, { ...init, method, headers, credentials: 'include' });
  };

  let response = await execute();
  const authRoute = /\/auth\/(?:login|refresh|session\/migrate)$/.test(url);
  if (response.status === 401 && options.retryAuth !== false && !authRoute) {
    try {
      await doRefresh();
      response = await execute();
    } catch (error) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aw:session-expired'));
      }
      throw error;
    }
  }
  return response;
}

export async function expectOk(response, fallbackMessage) {
  if (response.ok) return response;
  const detail = await responseMessage(response);
  throw new ApiError(detail || fallbackMessage || `请求失败（HTTP ${response.status}）`, response);
}
