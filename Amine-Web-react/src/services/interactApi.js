/**
 * 帖子互动 API 服务
 * 所有点赞/收藏操作均经由后端 /interact 端点持久化，不再依赖 localStorage
 */
import { apiFetch } from './apiClient.js';
import { authHeaders } from './auth.js';

const extractError = async (response) => {
    try {
        const data = await response.json();
        if (typeof data?.detail === 'string') return data.detail;
        if (Array.isArray(data?.detail)) return data.detail[0]?.msg || '操作失败';
    } catch {
        // ignore
    }
    return `HTTP ${response.status}`;
};

/**
 * 切换帖子点赞状态
 * @param {string} token - 认证 token
 * @param {number|string} postId - 帖子 ID（数字）
 * @returns {Promise<{ liked: boolean, post_id: number }>}
 */
export const togglePostLike = async (token, postId) => {
    const res = await apiFetch(`/interact/posts/${postId}/like`, {
        method: 'POST',
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 切换帖子收藏状态
 * @param {string} token - 认证 token
 * @param {number|string} postId - 帖子 ID（数字）
 * @returns {Promise<{ favorited: boolean, post_id: number }>}
 */
export const togglePostFavorite = async (token, postId) => {
    const res = await apiFetch(`/interact/posts/${postId}/favorite`, {
        method: 'POST',
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 获取当前用户所有已点赞/收藏的帖子 ID 列表（用于登录后批量初始化）
 * @param {string} token - 认证 token
 * @returns {Promise<{ liked_ids: number[], favorited_ids: number[] }>}
 */
export const getMyInteractionStatus = async (token) => {
    const res = await apiFetch('/interact/me/status', {
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 查询当前用户对某帖子的点赞/收藏状态
 * @param {string} token - 认证 token
 * @param {number|string} postId - 帖子 ID
 * @returns {Promise<{ liked: boolean, favorited: boolean }>}
 */
export const getMyPostStatus = async (token, postId) => {
    const res = await apiFetch(`/interact/posts/${postId}/me`, {
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};
