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

const resolveAuthorTag = (author) => {
    if (!author) return null;
    const raw = author.tagInfo || author.tag;
    if (!raw) return null;
    if (typeof raw === 'string') {
        const label = raw.trim();
        if (!label) return null;
        return { label, variant: author.isAdmin === true ? 'admin' : 'user' };
    }
    if (typeof raw === 'object') {
        const label = (raw.label || raw.title || '').trim();
        if (!label) return null;
        return {
            label,
            variant: raw.variant || (author.isAdmin === true ? 'admin' : 'user'),
        };
    }
    return null;
};

export const buildTagInfo = (author, meta = null) => {
    if (!author) return null;
    
    // 如果已有预构建的 tagInfo
    if (author.tagInfo) {
        return typeof author.tagInfo === 'object' 
            ? author.tagInfo 
            : { label: author.tagInfo, variant: 'user' };
    }
    
    // 从后端用户对象构建（使用后端字段名）
    const isAdmin = author.is_superuser === true;
    const title = (author.title || '').trim();
    
    if (title) {
        return {
            label: title,
            variant: isAdmin ? 'admin' : 'user',
        };
    }
    
    // 管理员默认显示"管理员"
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
