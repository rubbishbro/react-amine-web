/**
 * 用户关系 API 服务（关注 / 拉黑）
 * 所有操作均经由后端 /users 端点持久化，不再依赖 localStorage
 */
import { buildApiUrl } from '../pages/config/api.js';
import { authHeaders } from './auth.js';

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

// ─────────────────────────────────────────────
// 关注
// ─────────────────────────────────────────────

/**
 * 关注用户
 * POST /users/{user_id}/follow
 */
export const followUser = async (token, userId) => {
    const res = await fetch(buildApiUrl(`/users/${userId}/follow`), {
        method: 'POST',
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json(); // { success, relation }
};

/**
 * 取消关注
 * DELETE /users/{user_id}/follow
 */
export const unfollowUser = async (token, userId) => {
    const res = await fetch(buildApiUrl(`/users/${userId}/follow`), {
        method: 'DELETE',
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 切换关注状态（封装为一次调用）
 * @returns {{ isFollowing: boolean }}
 */
export const toggleFollowApi = async (token, userId, currentlyFollowing) => {
    if (currentlyFollowing) {
        await unfollowUser(token, userId);
        return { isFollowing: false };
    } else {
        await followUser(token, userId);
        return { isFollowing: true };
    }
};

/**
 * 获取当前用户与目标用户的关系状态
 * GET /users/{user_id}/relation
 */
export const getRelationStatus = async (token, userId) => {
    const res = await fetch(buildApiUrl(`/users/${userId}/relation`), {
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json(); // { is_following, is_blocked, is_muted, is_followed_by }
};

/**
 * 获取用户的粉丝数和关注数
 * GET /users/{user_id}/stats
 */
export const getUserRelationStats = async (userId) => {
    const res = await fetch(buildApiUrl(`/users/${userId}/stats`));
    if (!res.ok) throw new Error(await extractError(res));
    return res.json(); // { follower_count, following_count }
};

/**
 * 获取用户的粉丝列表
 * GET /users/{user_id}/followers
 */
export const getFollowers = async (userId, { skip = 0, limit = 100 } = {}) => {
    const res = await fetch(buildApiUrl(`/users/${userId}/followers?skip=${skip}&limit=${limit}`));
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 获取用户关注的人列表
 * GET /users/{user_id}/following
 */
export const getFollowing = async (userId, { skip = 0, limit = 100 } = {}) => {
    const res = await fetch(buildApiUrl(`/users/${userId}/following?skip=${skip}&limit=${limit}`));
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

// ─────────────────────────────────────────────
// 拉黑
// ─────────────────────────────────────────────

/**
 * 拉黑用户
 * POST /users/{user_id}/block
 */
export const blockUser = async (token, userId) => {
    const res = await fetch(buildApiUrl(`/users/${userId}/block`), {
        method: 'POST',
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 取消拉黑
 * DELETE /users/{user_id}/block
 */
export const unblockUser = async (token, userId) => {
    const res = await fetch(buildApiUrl(`/users/${userId}/block`), {
        method: 'DELETE',
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 切换拉黑状态（封装为一次调用）
 * @returns {{ blocked: boolean }}
 */
export const toggleBlockApi = async (token, userId, currentlyBlocked) => {
    if (currentlyBlocked) {
        await unblockUser(token, userId);
        return { blocked: false };
    } else {
        await blockUser(token, userId);
        return { blocked: true };
    }
};

/**
 * 获取我拉黑的用户列表
 * GET /users/me/blocked
 */
export const getMyBlockedUsers = async (token) => {
    const res = await fetch(buildApiUrl('/users/me/blocked'), {
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};
