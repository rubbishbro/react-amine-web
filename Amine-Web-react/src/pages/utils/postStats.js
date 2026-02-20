const LOCAL_STATS_KEY = 'aw_post_stats';

const DEFAULT_STATS = {
    views: 0,
    likes: 0,
    favorites: 0,
    replies: 0,
};

const safeNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const normalizeStats = (stats) => ({
    views: Math.max(0, safeNumber(stats.views)),
    likes: Math.max(0, safeNumber(stats.likes)),
    favorites: Math.max(0, safeNumber(stats.favorites)),
    replies: Math.max(0, safeNumber(stats.replies)),
});

const readStats = () => {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(LOCAL_STATS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.error('Error reading post stats:', error);
        return {};
    }
};

const writeStats = (stats) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
        console.error('Error writing post stats:', error);
    }
};

const emitStatsUpdate = (postId, stats) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('aw-post-stats-updated', {
        detail: { postId, stats }
    }));
};

export const getPostStats = (postId, baseStats = {}) => {
    if (!postId) return normalizeStats({ ...DEFAULT_STATS, ...baseStats });
    const store = readStats();
    const cached = store[postId] || {};
    return normalizeStats({ ...DEFAULT_STATS, ...baseStats, ...cached });
};

export const setPostStats = (postId, nextStats = {}) => {
    if (!postId) return normalizeStats({ ...DEFAULT_STATS, ...nextStats });
    const store = readStats();
    const current = store[postId] || {};
    const merged = normalizeStats({ ...DEFAULT_STATS, ...current, ...nextStats });
    store[postId] = merged;
    writeStats(store);
    emitStatsUpdate(postId, merged);
    return merged;
};

const updateStat = (postId, key, delta = 1) => {
    if (!postId) return DEFAULT_STATS;
    const current = getPostStats(postId);
    const nextValue = Math.max(0, safeNumber(current[key]) + safeNumber(delta));
    return setPostStats(postId, { [key]: nextValue });
};

export const incrementPostViews = (postId) => updateStat(postId, 'views', 1);

export const updatePostLikes = (postId, delta) => updateStat(postId, 'likes', delta);

export const updatePostFavorites = (postId, delta) => updateStat(postId, 'favorites', delta);

export const updatePostReplies = (postId, delta) => updateStat(postId, 'replies', delta);

export const syncPostReplies = (postId, count) => setPostStats(postId, { replies: safeNumber(count) });

export const onPostStatsUpdated = (handler) => {
    if (typeof window === 'undefined') return () => { };
    const listener = (event) => handler?.(event);
    window.addEventListener('aw-post-stats-updated', listener);
    return () => window.removeEventListener('aw-post-stats-updated', listener);
};
