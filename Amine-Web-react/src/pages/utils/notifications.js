/**
 * 通知工具层（后端优先版）
 *
 * 所有读写操作优先经由 /notifications API 持久化。
 * localStorage 仅作离线 fallback（key: aw_notifications_cache）。
 *
 * 向后兼容：继续暴露与旧版相同的函数名，但在有 token 时会同步到后端。
 * 旧同步接口（如 getUserNotifications(userId)）仍保留，读取本地缓存。
 */
import {
    getNotifications,
    markNotificationReadApi,
    markAllReadApi,
    clearReadNotificationsApi,
} from '../../services/notificationsApi.js';

const CACHE_KEY = 'aw_notifications_cache';
const UPDATE_EVENT = 'aw-notifications-updated';

// ── 本地缓存读写 ───────────────────────────────────────────────────────────────

const readCache = () => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
};

const writeCache = (list) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(list));
        window.dispatchEvent(new Event(UPDATE_EVENT));
    } catch { /* ignore */ }
};

// 将后端通知对象归一化为前端统一格式
const normalize = (n) => ({
    id: String(n.id),
    userId: String(n.recipient_id),
    targetType: n.post_id ? 'post' : 'reply',
    action: n.type,             // 'like' | 'reply' | 'follow' | 'system'
    postId: n.post_id ? String(n.post_id) : undefined,
    replyId: n.comment_id ? String(n.comment_id) : undefined,
    preview: n.content || '',
    fromUserId: n.sender_id ? String(n.sender_id) : undefined,
    createdAt: n.created_at,
    read: n.is_read,
    _raw: n,
});

// ── 异步 API（主流程使用）────────────────────────────────────────────────────

/**
 * 从后端拉取通知列表并更新本地缓存
 * @param {string} token
 * @param {{ unread_only?:boolean }} opts
 */
export const syncNotificationsFromBackend = async (token, { unread_only = false } = {}) => {
    if (!token) return readCache();
    try {
        const list = await getNotifications(token, { limit: 100, unread_only });
        const normalized = list.map(normalize);
        writeCache(normalized);
        return normalized;
    } catch (err) {
        console.warn('[notifications] 从后端同步失败，使用本地缓存:', err);
        return readCache();
    }
};

// ── 同步接口（向后兼容，读本地缓存）────────────────────────────────────────────

/** 获取指定用户的通知列表（同步，读本地缓存） */
export const getUserNotifications = (userId) => {
    if (!userId) return [];
    return readCache().filter((n) => n.userId === String(userId));
};

/** 获取未读通知数（同步，读本地缓存） */
export const getUnreadNotificationCount = (userId) => {
    if (!userId) return 0;
    return readCache().filter((n) => n.userId === String(userId) && !n.read).length;
};

/**
 * 标记单条通知已读（乐观更新 + 后端同步）
 * @param {string|number} notificationId
 * @param {string} [token]
 */
export const markNotificationRead = (notificationId, token) => {
    const id = String(notificationId);
    const list = readCache();
    const next = list.map((n) => n.id === id ? { ...n, read: true } : n);
    writeCache(next);
    if (token) {
        markNotificationReadApi(token, notificationId).catch(() => { /* ignore */ });
    }
    return next;
};

/**
 * 全部标为已读（乐观更新 + 后端同步）
 * @param {string} userId
 * @param {string} [token]
 */
export const markAllNotificationsRead = (userId, token) => {
    const list = readCache();
    const next = list.map((n) => n.userId === String(userId) ? { ...n, read: true } : n);
    writeCache(next);
    if (token) {
        markAllReadApi(token).catch(() => { /* ignore */ });
    }
    return next;
};

/**
 * 清除已读通知（乐观删除 + 后端同步）
 * @param {string} userId
 * @param {string} [token]
 */
export const clearReadNotifications = (userId, token) => {
    const list = readCache();
    const next = list.filter((n) => n.userId !== String(userId) || !n.read);
    writeCache(next);
    if (token) {
        clearReadNotificationsApi(token).catch(() => { /* ignore */ });
    }
    return next;
};

/** 订阅通知更新事件 */
export const onNotificationsUpdated = (handler) => {
    if (typeof window === 'undefined') return () => { };
    const listener = () => handler?.();
    window.addEventListener(UPDATE_EVENT, listener);
    return () => window.removeEventListener(UPDATE_EVENT, listener);
};
