import { buildApiUrl } from '../pages/config/api.js';

const TOKEN_KEY = 'aw_access_token';

const parseErrorMessage = async (response) => {
  try {
    const data = await response.json();
    if (typeof data === 'string') return data;
    if (data?.detail) return Array.isArray(data.detail) ? data.detail[0]?.msg || '' : data.detail;
  } catch {
    // ignore
  }
  return '';
};

export const readStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const saveToken = (token) => {
  if (!token) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore write errors
  }
};

export const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
};

export const authHeaders = (token = readStoredToken()) =>
  token ? { Authorization: `Bearer ${token}` } : {};

export async function requestToken({ username, password }) {
  const formData = new URLSearchParams();
  formData.set('username', username);
  formData.set('password', password);

  const response = await fetch(buildApiUrl('/login/access-token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new Error(detail || `登录失败（HTTP ${response.status}）`);
  }

  const data = await response.json();
  if (!data?.access_token) {
    throw new Error('后端未返回访问令牌 access_token');
  }
  return data.access_token;
}

export async function fetchCurrentUser(token) {
  if (!token) throw new Error('缺少登录令牌');
  const response = await fetch(buildApiUrl('/users/me'), {
    headers: {
      ...authHeaders(token),
    },
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new Error(detail || `获取用户信息失败（HTTP ${response.status}）`);
  }

  return response.json();
}
