import { resolveMediaUrl } from '../pages/config/api.js';
import { apiFetch, expectOk } from './apiClient.js';

const LEGACY_TOKEN_KEY = 'aw_access_token';

const normalizeUserMedia = (user) => user ? {
  ...user,
  avatar_url: resolveMediaUrl(user.avatar_url),
  cover_url: resolveMediaUrl(user.cover_url),
} : user;

export const readStoredToken = () => {
  try {
    return localStorage.getItem(LEGACY_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const clearToken = () => {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Storage may be disabled; the server-side session still works.
  }
};

// Kept temporarily for service call compatibility. New browser requests use Cookie auth.
export const authHeaders = () => ({});

export async function migrateLegacySession() {
  const token = readStoredToken();
  if (!token) return null;
  const response = await apiFetch('/auth/session/migrate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }, { retryAuth: false });
  await expectOk(response, '旧登录状态迁移失败');
  clearToken();
  return normalizeUserMedia(await response.json());
}

export async function loginWithPassword({ identifier, password }) {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  }, { retryAuth: false });
  await expectOk(response, '邮箱、用户名或密码错误');
  clearToken();
  return normalizeUserMedia(await response.json());
}

export async function logoutSession() {
  const response = await apiFetch('/auth/logout', { method: 'POST' }, { retryAuth: false });
  await expectOk(response, '退出登录失败');
  clearToken();
}

export async function sendEmailCode({ email, purpose }) {
  const response = await apiFetch('/auth/email-code/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), purpose }),
  }, { retryAuth: false });
  await expectOk(response, '发送验证码失败');
  return response.json();
}

export async function registerByEmail({ email, password, confirmPassword, code }) {
  const response = await apiFetch('/auth/register-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      confirm_password: confirmPassword,
      code,
    }),
  }, { retryAuth: false });
  await expectOk(response, '注册失败');
  return response.json();
}

export async function resetPasswordByEmailCode({ email, password, confirmPassword, code }) {
  const response = await apiFetch('/auth/password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
      confirm_password: confirmPassword,
      code,
    }),
  }, { retryAuth: false });
  await expectOk(response, '重置密码失败');
  return response.json();
}

export async function fetchCurrentUser() {
  const response = await apiFetch('/users/me');
  await expectOk(response, '获取用户信息失败');
  return normalizeUserMedia(await response.json());
}

export async function fetchUserByUsername(username) {
  if (!username) return null;
  try {
    const response = await apiFetch(`/users/username/${encodeURIComponent(username)}`);
    if (!response.ok) return null;
    return normalizeUserMedia(await response.json());
  } catch {
    return null;
  }
}

export async function uploadFile(_legacyToken, file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiFetch('/upload/', { method: 'POST', body: formData });
  await expectOk(response, '上传失败');
  const result = await response.json();
  return { ...result, url: resolveMediaUrl(result?.url) };
}

export async function updateUserProfile(_legacyToken, profile = {}) {
  const body = {
    username: profile.username,
    userSchool: profile.userSchool,
    userClass: profile.userClass,
    bio: profile.bio,
    avatar_url: profile.avatarUrl,
    cover_url: profile.coverUrl,
  };
  Object.keys(body).forEach((key) => body[key] === undefined && delete body[key]);
  const response = await apiFetch('/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await expectOk(response, '更新个人资料失败');
  return normalizeUserMedia(await response.json());
}

export async function updateUserAvatar(_legacyToken, { avatarUrl, coverUrl } = {}) {
  const response = await apiFetch('/users/me/avatar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar_url: avatarUrl, cover_url: coverUrl }),
  });
  await expectOk(response, '头像更新失败');
  return normalizeUserMedia(await response.json());
}
