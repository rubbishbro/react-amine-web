const buildKey = (viewerId) => `aw_block_list_${viewerId || 'guest'}`;

const readList = (viewerId) => {
    if (!viewerId) return [];
    try {
        const raw = localStorage.getItem(buildKey(viewerId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeList = (viewerId, list) => {
    if (!viewerId) return;
    try {
        localStorage.setItem(buildKey(viewerId), JSON.stringify(list));
    } catch (error) {
        console.error('Failed to save block list:', error);
    }
};

export const isBlocked = (viewerId, targetId) => {
    if (!viewerId || !targetId) return false;
    const list = readList(viewerId);
    return list.includes(targetId);
};

export const toggleBlock = (viewerId, targetId) => {
    if (!viewerId || !targetId) return { blocked: false };
    const list = readList(viewerId);
    const index = list.indexOf(targetId);
    if (index >= 0) {
        list.splice(index, 1);
        writeList(viewerId, list);
        return { blocked: false };
    }
    list.push(targetId);
    writeList(viewerId, list);
    return { blocked: true };
};

export const readBlockedList = (viewerId) => readList(viewerId);
