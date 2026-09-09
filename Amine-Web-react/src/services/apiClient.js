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

// 跨标签页单飞：同一浏览器只允许一个标签执行 refresh 轮换，
// 避免多标签同时拿旧 refresh token 触发重放保护把整段会话吊销。
const REFRESH_LOCK_KEY = 'aw-refresh-lock';
const REFRESH_LOCK_TTL = 8000;

const takeRefreshLock = () => {
  if (typeof window === 'undefined') return true;
  try {
    const now = Date.now();
    const raw = localStorage.getItem(REFRESH_LOCK_KEY);
    if (raw) {
      const ts = Number(raw) || 0;
      if (now - ts < REFRESH_LOCK_TTL) return false;
    }
    localStorage.setItem(REFRESH_LOCK_KEY, String(now));
    return true;
  } catch {
    return true;
  }
};

const releaseRefreshLock = () => {
  try {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  } catch {
    // ignore
  }
};

const waitRefreshLockGone = (timeout = REFRESH_LOCK_TTL) => new Promise((resolve) => {
  const started = Date.now();
  const tick = () => {
    let free = true;
    try {
      const raw = localStorage.getItem(REFRESH_LOCK_KEY);
      free = !raw || Date.now() - (Number(raw) || 0) >= REFRESH_LOCK_TTL;
    } catch {
      free = true;
    }
    if (free || Date.now() - started >= timeout) {
      resolve();
      return;
    }
    setTimeout(tick, 120);
  };
  tick();
});

const doRefresh = async () => {
  if (refreshPromise) return refreshPromise;
  const performRefresh = async () => {
    // 若其它标签正在刷新，等它完成（成功后本标签 cookie 已更新）
    if (!takeRefreshLock()) {
      await waitRefreshLockGone();
      if (!takeRefreshLock()) return;
    }
    try {
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
    } finally {
      releaseRefreshLock();
    }
  };
  refreshPromise = performRefresh().finally(() => {
    refreshPromise = null;
  });
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
