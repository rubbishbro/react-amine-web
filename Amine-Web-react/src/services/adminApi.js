/**
 * 管理员后端 API 服务
 * 所有管理员操作均通过此服务与后端交互，不再依赖 localStorage
 */
import { buildApiUrl } from '../pages/config/api.js';
import { authHeaders } from './auth.js';

/**
 * 统一错误处理：提取后端 detail 字段或 HTTP 状态文本
 */
const extractError = async (response) => {
    try {
        const data = await response.json();
        if (typeof data?.detail === 'string') return data.detail;
        if (Array.isArray(data?.detail)) return data.detail[0]?.msg || '操作失败';
    } catch {
        // ignore
    }
    return `操作失败（HTTP ${response.status}）`;
};

/**
 * 获取指定用户的完整信息（仅管理员）
 * GET /admin/users/{user_id}
 */
export const adminGetUser = async (token, userId) => {
    const res = await fetch(buildApiUrl(`/admin/users/${userId}`), {
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 获取用户列表（仅管理员）
 * GET /admin/users?skip=0&limit=50
 */
export const adminListUsers = async (token, { skip = 0, limit = 50 } = {}) => {
    const res = await fetch(buildApiUrl(`/admin/users?skip=${skip}&limit=${limit}`), {
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 按昵称/邮箱搜索用户（仅管理员）
 * GET /admin/users?q=xxx&skip=0&limit=20
 */
export const adminSearchUsers = async (token, keyword, { skip = 0, limit = 20 } = {}) => {
    const q = encodeURIComponent(String(keyword || '').trim());
    const res = await fetch(buildApiUrl(`/admin/users?q=${q}&skip=${skip}&limit=${limit}`), {
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 设置用户头衔（仅管理员）
 * PUT /admin/users/{user_id}/title
 */
export const adminSetTitle = async (token, userId, title) => {
    const res = await fetch(buildApiUrl(`/admin/users/${userId}/title`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 设置用户权限（仅管理员）
 * PUT /admin/users/{user_id}/role
 */
export const adminSetRole = async (token, userId, is_superuser) => {
    const res = await fetch(buildApiUrl(`/admin/users/${userId}/role`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ is_superuser }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 禁言用户（仅管理员）
 * POST /admin/users/{user_id}/mute
 */
export const adminMuteUser = async (token, userId, reason = '') => {
    const res = await fetch(buildApiUrl(`/admin/users/${userId}/mute`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 取消禁言（仅管理员）
 * DELETE /admin/users/{user_id}/mute
 */
export const adminUnmuteUser = async (token, userId) => {
    const res = await fetch(buildApiUrl(`/admin/users/${userId}/mute`), {
        method: 'DELETE',
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 封禁用户（仅管理员）
 * POST /admin/users/{user_id}/ban
 */
export const adminBanUser = async (token, userId, reason = '') => {
    const res = await fetch(buildApiUrl(`/admin/users/${userId}/ban`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 取消封禁（仅管理员）
 * DELETE /admin/users/{user_id}/ban
 */
export const adminUnbanUser = async (token, userId) => {
    const res = await fetch(buildApiUrl(`/admin/users/${userId}/ban`), {
        method: 'DELETE',
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 删除用户（仅管理员）
 * DELETE /admin/users/{user_id}
 */
export const adminDeleteUser = async (token, userId) => {
    const res = await fetch(buildApiUrl(`/admin/users/${userId}`), {
        method: 'DELETE',
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 用管理员密钥激活当前用户的管理员权限
 * POST /admin/activate
 */
export const adminActivate = async (token, secretKey) => {
    const res = await fetch(buildApiUrl('/admin/activate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ secret_key: secretKey }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};
