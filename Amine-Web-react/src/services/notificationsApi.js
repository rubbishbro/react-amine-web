/**
 * 通知 API 服务
 * 所有通知操作经由后端 /notifications 端点持久化
 */
import { buildApiUrl } from '../pages/config/api.js';
import { authHeaders } from './auth.js';

const extractError = async (res) => {
    try {
        const d = await res.json();
        if (typeof d?.detail === 'string') return d.detail;
        if (Array.isArray(d?.detail)) return d.detail[0]?.msg || '操作失败';
    } catch { /* ignore */ }
    return `HTTP ${res.status}`;
};

/**
 * 获取当前用户通知列表
 * @param {string} token
 * @param {{ skip?:number, limit?:number, unread_only?:boolean }} opts
 * @returns {Promise<Notification[]>}
 */
export const getNotifications = async (token, { skip = 0, limit = 50, unread_only = false } = {}) => {
    const params = new URLSearchParams({ skip, limit, unread_only });
    const res = await fetch(buildApiUrl(`/notifications/?${params}`), { headers: authHeaders(token) });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 获取未读通知数量
 * @returns {Promise<{ unread_count: number }>}
 */
export const getUnreadNotificationCount = async (token) => {
    const res = await fetch(buildApiUrl('/notifications/unread-count'), { headers: authHeaders(token) });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 推送一条通知（由触发动作的用户调用）
 * @param {string} token
 * @param {{ recipient_id:number, type:string, post_id?:number, comment_id?:number, content?:string }} payload
 */
export const pushNotificationApi = async (token, payload) => {
    const res = await fetch(buildApiUrl('/notifications/push'), {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 标记单条通知已读
 * @param {string} token
 * @param {number} notificationId
 */
export const markNotificationReadApi = async (token, notificationId) => {
    const res = await fetch(buildApiUrl(`/notifications/${notificationId}/read`), {
        method: 'PATCH',
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 标记所有通知已读
 * @returns {Promise<{ marked: number }>}
 */
export const markAllReadApi = async (token) => {
    const res = await fetch(buildApiUrl('/notifications/read-all'), {
        method: 'POST',
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 清除所有已读通知
 * @returns {Promise<{ deleted: number }>}
 */
export const clearReadNotificationsApi = async (token) => {
    const res = await fetch(buildApiUrl('/notifications/clear-read'), {
        method: 'DELETE',
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};
