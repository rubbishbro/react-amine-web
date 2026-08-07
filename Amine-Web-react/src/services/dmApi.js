/**
 * 私信 REST API 服务
 * WebSocket 连接管理见 dmWsClient.js
 */
import { apiFetch } from './apiClient.js';
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
 * 获取会话列表（每个会话取最新一条消息）
 * @param {string} token
 * @returns {Promise<{ other_id:number, unread_count:number, last_message:{} }[]>}
 */
export const getDmThreads = async (token) => {
    const res = await apiFetch('/dm/threads', { headers: authHeaders(token) });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 获取与某用户的完整聊天记录（同时标记对方发来的消息为已读）
 * @param {string} token
 * @param {number|string} otherId
 * @param {{ skip?:number, limit?:number }} opts
 * @returns {Promise<Message[]>}
 */
export const getDmThread = async (token, otherId, { skip = 0, limit = 50 } = {}) => {
    const params = new URLSearchParams({ skip, limit });
    const res = await apiFetch(`/dm/thread/${otherId}?${params}`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

export const markDmThreadRead = async (token, otherId) => {
    const res = await apiFetch(`/dm/thread/${otherId}/read`, {
        method: 'POST',
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * REST 方式发送私信（WebSocket 不可用时的回退方案）
 * @param {string} token
 * @param {{ receiver_id:number, content:string }} payload
 * @returns {Promise<Message>}
 */
export const sendDm = async (token, payload) => {
    const res = await apiFetch('/dm/send', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 撤回一条消息
 * @returns {Promise<Message>}
 */
export const recallDm = async (token, messageId) => {
    const res = await apiFetch(`/dm/${messageId}/recall`, {
        method: 'POST',
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 删除一条消息
 * @returns {Promise<{ deleted:boolean }>}
 */
export const deleteDm = async (token, messageId) => {
    const res = await apiFetch(`/dm/${messageId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};

/**
 * 获取未读私信总数
 * @returns {Promise<{ unread_count:number }>}
 */
export const getDmUnreadCount = async (token) => {
    const res = await apiFetch('/dm/unread-count', { headers: authHeaders(token) });
    if (!res.ok) throw new Error(await extractError(res));
    return res.json();
};
