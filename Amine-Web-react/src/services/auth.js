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
    throw new Error(detail || `邮箱或密码错误（HTTP ${response.status}）`);
  }

  const data = await response.json();
  if (!data?.access_token) {
    throw new Error('后端未返回访问令牌 access_token');
  }
  return data.access_token;
}

export async function sendEmailCode({ email, purpose }) {
  const response = await fetch(buildApiUrl('/auth/email-code/send'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, purpose }),
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new Error(detail || `发送验证码失败（HTTP ${response.status}）`);
  }

  return response.json();
}

export async function registerByEmail({ email, password, confirmPassword, code }) {
  const response = await fetch(buildApiUrl('/auth/register-email'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      confirm_password: confirmPassword,
      code,
    }),
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new Error(detail || `注册失败（HTTP ${response.status}）`);
  }

  return response.json();
}

export async function resetPasswordByEmailCode({ email, password, confirmPassword, code }) {
  const response = await fetch(buildApiUrl('/auth/password-reset'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      confirm_password: confirmPassword,
      code,
    }),
  });

  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new Error(detail || `重置密码失败（HTTP ${response.status}）`);
  }

  return response.json();
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

/**
 * 根据用户名获取用户公开信息（无需登录）
 * GET /users/username/{username}
 */
export async function fetchUserByUsername(username) {
  if (!username) return null;
  try {
    const response = await fetch(buildApiUrl(`/users/username/${encodeURIComponent(username)}`));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * 上传图片或音频文件，返回后端 URL
 * 配置了七牛云时返回 CDN 地址，否则返回本地 /static/uploads/... 路径
 */
export async function uploadFile(token, file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(buildApiUrl('/upload/'), {
    method: 'POST',
    headers: authHeaders(token),  // 不要手动设置 Content-Type，浏览器自动带 boundary
    body: formData,
  });
  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new Error(detail || `上传失败（HTTP ${response.status}）`);
  }
  return response.json(); // { url: '...' }
}

/**
 * 更新当前用户的头像 / 头图 URL（写入数据库）
 */
export async function updateUserAvatar(token, { avatarUrl, coverUrl } = {}) {
  const body = {};
  if (avatarUrl !== undefined) body.avatar_url = avatarUrl;
  if (coverUrl !== undefined) body.cover_url = coverUrl;
  const response = await fetch(buildApiUrl('/users/me/avatar'), {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await parseErrorMessage(response);
    throw new Error(detail || '头像更新失败');
  }
  return response.json();
}
