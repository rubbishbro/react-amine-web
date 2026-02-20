const normalizeName = (value) => (value ?? '').toString().trim();

export const isUuidV4 = (value) => {
    if (!value) return false;
    const text = value.toString().trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text);
};

export const isSequentialId = (value) => {
    if (!value) return false;
    const text = value.toString().trim();
    return /^[1-9]\d*$/.test(text);
};

export const isSupportedUserId = (value) => isUuidV4(value) || isSequentialId(value);

const USER_ID_MAP_KEY = 'aw_user_id_map';

const readUserIdMap = () => {
    try {
        const raw = localStorage.getItem(USER_ID_MAP_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writeUserIdMap = (map) => {
    try {
        localStorage.setItem(USER_ID_MAP_KEY, JSON.stringify(map));
    } catch {
        // Ignore write failures.
    }
};

export const getMappedUserId = (value) => {
    if (!value) return value;
    const key = value.toString().trim();
    if (!key) return value;
    const map = readUserIdMap();
    return map[key] || value;
};

export const recordUserIdMapping = (oldId, newId) => {
    if (!oldId || !newId) return;
    const source = oldId.toString().trim();
    const target = newId.toString().trim();
    if (!source || !target || source === target) return;
    const map = readUserIdMap();
    if (map[source] === target) return;
    map[source] = target;
    writeUserIdMap(map);
};

export const mapLegacyUserId = (value) => {
    if (!value) return value;
    if (!isUuidV4(value)) return value;
    const mapped = getMappedUserId(value);
    if (mapped !== value) return mapped;
    const next = createUuid();
    recordUserIdMapping(value, next);
    return next;
};

export const createUuid = () => {
    const storageKey = 'aw_user_seq';
    let current = 0;
    try {
        const raw = localStorage.getItem(storageKey);
        const parsed = Number.parseInt(raw ?? '', 10);
        if (Number.isFinite(parsed) && parsed > 0) current = parsed;
    } catch {
        current = 0;
    }
    const next = current + 1;
    try {
        localStorage.setItem(storageKey, String(next));
    } catch {
        // Ignore write failures; still return the next value for this session.
    }
    return String(next);
};

export const buildUserId = (name, fallbackId = 'guest') => {
    const safeName = normalizeName(name);
    const mappedFallback = fallbackId ? getMappedUserId(fallbackId) : fallbackId;
    if (mappedFallback && isSupportedUserId(mappedFallback)) return mappedFallback;
    if (fallbackId && fallbackId !== 'guest' && fallbackId !== 'local') {
        return fallbackId;
    }
    if (safeName && safeName !== '游客' && safeName !== '匿名') {
        return encodeURIComponent(safeName);
    }
    return fallbackId || 'guest';
};

export const buildUserIdentity = (user, fallbackId = 'guest') => {
    const name = user?.profile?.name || '游客';
    const id = buildUserId(name, user?.id || fallbackId);
    return { id, name };
};

export const isValidProfileName = (name) => {
    const trimmed = (name ?? '').toString().trim();
    return !!trimmed && trimmed !== '游客' && trimmed !== '匿名';
};

export const getCurrentViewerId = () => {
    try {
        const raw = localStorage.getItem('aw_user');
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        if (parsed?.loggedIn !== true) return '';
        const fallbackId = parsed?.id || 'guest';
        const mappedFallback = getMappedUserId(fallbackId);
        if (isSupportedUserId(mappedFallback)) return mappedFallback;
        const name = parsed?.profile?.name || '游客';
        return buildUserId(name, mappedFallback || fallbackId);
    } catch {
        return '';
    }
};
