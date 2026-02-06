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
