/**
 * blockStore.js
 *
 * ⚠️ 迁移说明：
 *   - 拉黑数据已迁移至后端，通过 services/relationsApi.js 持久化
 *   - 本文件提供两套 API：
 *     1. 本地缓存（同步）—— 用于 UI 初始值展示（快速渲染），数据来自上次后端同步
 *     2. 后端 API（异步）—— 用于真正的拉黑/取消拉黑操作
 *   - localStorage `aw_block_list_*` 已废弃，不再写入
 */
import {
    blockUser,
    unblockUser,
    getMyBlockedUsers,
} from '../../services/relationsApi.js';

// ─── 本地缓存键 ──────────────────────────────────────────────────────────
const BLOCK_CACHE_KEY = 'aw_block_cache'; // { [viewerId]: string[] }

const readCache = () => {
    try {
        const raw = localStorage.getItem(BLOCK_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writeCache = (data) => {
    try {
        localStorage.setItem(BLOCK_CACHE_KEY, JSON.stringify(data));
    } catch {
        // ignore
    }
};

// ─── 后端同步：将真实拉黑列表写入本地缓存 ──────────────────────────────
/**
 * 从后端拉取当前用户的拉黑列表，并写入本地缓存
 * @param {string} token - 登录 token
 * @param {string|number} viewerId - 当前用户的后端 ID
 * @returns {Promise<string[]>} - 被拉黑用户的 ID 列表（字符串数组）
 */
export const syncBlockedFromBackend = async (token, viewerId) => {
    if (!token || !viewerId) return [];
    try {
        const users = await getMyBlockedUsers(token);
        const ids = (users || []).map((u) => String(u.id));
        const cache = readCache();
        cache[String(viewerId)] = ids;
        writeCache(cache);
        return ids;
    } catch (err) {
        console.warn('[blockStore] syncBlockedFromBackend 失败:', err.message);
        return [];
    }
};

// ─── 同步读缓存（用于 useMemo 初始值）────────────────────────────────────
/**
 * 从本地缓存读取是否已拉黑目标用户（初始值，不保证最新）
 * 调用方应在 useEffect 中调用 syncBlockedFromBackend 获取真实值
 */
export const isBlocked = (viewerId, targetId) => {
    if (!viewerId || !targetId) return false;
    const cache = readCache();
    const list = cache[String(viewerId)];
    return Array.isArray(list) ? list.includes(String(targetId)) : false;
};

/**
 * 从本地缓存读取拉黑列表（初始值，不保证最新）
 */
export const readBlockedList = (viewerId) => {
    if (!viewerId) return [];
    const cache = readCache();
    return cache[String(viewerId)] || [];
};

// ─── 异步操作（调用后端 API + 更新本地缓存）──────────────────────────────
/**
 * 切换拉黑状态（调用后端 API 并更新本地缓存）
 * @param {string} token - 登录 token
 * @param {string|number} viewerId - 当前用户后端 ID
 * @param {string|number} targetId - 目标用户后端 ID
 * @returns {Promise<{ blocked: boolean }>}
 */
export const toggleBlock = async (token, viewerId, targetId) => {
    if (!token || !viewerId || !targetId) return { blocked: false };
    const currentlyBlocked = isBlocked(viewerId, targetId);
    try {
        if (currentlyBlocked) {
            await unblockUser(token, targetId);
        } else {
            await blockUser(token, targetId);
        }
        const nextBlocked = !currentlyBlocked;
        const cache = readCache();
        const list = Array.isArray(cache[String(viewerId)]) ? [...cache[String(viewerId)]] : [];
        if (nextBlocked) {
            if (!list.includes(String(targetId))) list.push(String(targetId));
        } else {
            const idx = list.indexOf(String(targetId));
            if (idx >= 0) list.splice(idx, 1);
        }
        cache[String(viewerId)] = list;
        writeCache(cache);
        return { blocked: nextBlocked };
    } catch (err) {
        throw err;
    }
};
