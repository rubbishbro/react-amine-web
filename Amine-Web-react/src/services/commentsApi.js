/**
 * 评论 API 服务
 * 所有评论操作均经由后端 /comments 端点持久化，不再依赖 localStorage
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
    return `操作失败（HTTP ${response.status}）`;
};

// ─────────────────────────────────────────────
// 读取
// ─────────────────────────────────────────────

/**
 * 获取帖子的评论列表（含作者信息）
 * GET /comments/post/{post_id}
 * @returns {Array<{ id, post_id, author_id, author_name, author_avatar, content, parent_id, likes, created_at, updated_at, is_deleted }>}
 */
export const getPostComments = async (postId, { skip = 0, limit = 100 } = {}) => {
    const res = await apiFetch(`/comments/post/${postId}?skip=${skip}&limit=${limit}`);
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 获取评论的回复列表
 * GET /comments/{comment_id}/replies
 */
export const getCommentReplies = async (commentId, { skip = 0, limit = 50 } = {}) => {
    const res = await apiFetch(`/comments/${commentId}/replies?skip=${skip}&limit=${limit}`);
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 获取帖子评论总数
 * GET /comments/post/{post_id}/count
 */
export const getCommentCount = async (postId) => {
    const res = await apiFetch(`/comments/post/${postId}/count`);
    if (!res.ok) throw new Error(await extractError(res));
    const data = await res.json();
    return data.count ?? 0;
};

// ─────────────────────────────────────────────
// 写入
// ─────────────────────────────────────────────

/**
 * 创建评论（或回复）
 * POST /comments/
 * @param {string} token - 登录 token
 * @param {{ post_id: number, content: string, parent_id?: number }} payload
 */
export const createComment = async (token, payload) => {
    const res = await apiFetch('/comments/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 更新评论内容（仅作者本人）
 * PUT /comments/{comment_id}
 */
export const updateComment = async (token, commentId, content) => {
    const res = await apiFetch(`/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 删除评论（软删除，仅作者本人或管理员）
 * DELETE /comments/{comment_id}
 */
export const deleteComment = async (token, commentId) => {
    const res = await apiFetch(`/comments/${commentId}`, {
        method: 'DELETE',
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json(); // { message: "评论已删除" }
};

/**
 * 点赞/取消点赞评论
 * POST /comments/{comment_id}/like
 * @returns {{ success: boolean, likes: number }}
 */
export const likeComment = async (token, commentId) => {
    const res = await apiFetch(`/comments/${commentId}/like`, {
        method: 'POST',
        headers: { ...authHeaders(token) },
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};
