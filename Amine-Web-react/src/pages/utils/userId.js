const normalizeName = (value) => (value ?? '').toString().trim();

export const buildUserId = (name, fallbackId = 'guest') => {
    const safeName = normalizeName(name);
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
