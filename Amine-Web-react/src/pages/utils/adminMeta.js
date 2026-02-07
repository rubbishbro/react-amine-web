const buildStorageKey = (userId) => `aw_admin_meta_${userId || 'guest'}`;

const DEFAULT_META = {
    title: '',
    role: null,
    createdAt: '2024-01-01T00:00:00Z',
    lastActiveAt: '2026-02-01T00:00:00Z',
    reportsReceived: 0,
    reportsSubmitted: 0,
    muteCount: 0,
    banCount: 0,
    isMuted: false,
    isBanned: false,
};

const safeNumber = (value) => (Number.isFinite(value) ? value : 0);

export const readAdminMeta = (userId) => {
    if (!userId) return { ...DEFAULT_META };
    try {
        const raw = localStorage.getItem(buildStorageKey(userId));
        if (!raw) return { ...DEFAULT_META };
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_META,
            ...parsed,
            reportsReceived: safeNumber(parsed?.reportsReceived),
            reportsSubmitted: safeNumber(parsed?.reportsSubmitted),
            muteCount: safeNumber(parsed?.muteCount),
            banCount: safeNumber(parsed?.banCount),
        };
    } catch {
        return { ...DEFAULT_META };
    }
};

export const writeAdminMeta = (userId, meta) => {
    if (!userId) return;
    try {
        localStorage.setItem(buildStorageKey(userId), JSON.stringify({ ...DEFAULT_META, ...meta }));
    } catch (error) {
        console.error('Failed to save admin meta:', error);
    }
};

export const deleteAdminMeta = (userId) => {
    if (!userId) return;
    try {
        localStorage.removeItem(buildStorageKey(userId));
    } catch (error) {
        console.error('Failed to delete admin meta:', error);
    }
};

export const buildTagInfo = (author, meta) => {
    if (!author && !meta) return null;
    const role = meta?.role;
    const isAdmin = role ? role === 'admin' : author?.isAdmin === true;
    const title = (meta?.title || '').trim();
    if (title) {
        return {
            label: title,
            variant: isAdmin ? 'admin' : 'user',
        };
    }
    if (isAdmin) {
        return { label: '管理员', variant: 'admin' };
    }
    return null;
};

/**
 * 检查用户是否被禁言
 */
export const isUserMuted = (userId) => {
    if (!userId) return false;
    const meta = readAdminMeta(userId);
    return meta.isMuted === true;
};

/**
 * 检查用户是否被封禁
 */
export const isUserBanned = (userId) => {
    if (!userId) return false;
    const meta = readAdminMeta(userId);
    return meta.isBanned === true;
};

/**
 * 获取用户的禁言/封禁状态
 */
export const getUserRestrictions = (userId) => {
    if (!userId) return { isMuted: false, isBanned: false };
    const meta = readAdminMeta(userId);
    return {
        isMuted: meta.isMuted === true,
        isBanned: meta.isBanned === true,
    };
};

/**
 * 管理员密钥
 */
const ADMIN_SECRET_KEY = 'E动漫社forever';

/**
 * 验证管理员密钥
 */
export const verifyAdminKey = (inputKey) => {
    return inputKey && inputKey.trim() === ADMIN_SECRET_KEY;
};
