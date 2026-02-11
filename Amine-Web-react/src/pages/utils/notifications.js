const LOCAL_NOTIFICATIONS_KEY = 'aw_notifications';

const readNotifications = () => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Error reading notifications:', error);
        return [];
    }
};

const writeNotifications = (list) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(list));
        window.dispatchEvent(new Event('aw-notifications-updated'));
    } catch (error) {
        console.error('Error writing notifications:', error);
    }
};

export const getUserNotifications = (userId) => {
    if (!userId) return [];
    const all = readNotifications();
    return all.filter((item) => item?.userId === userId);
};

export const getUnreadNotificationCount = (userId) => {
    if (!userId) return 0;
    const list = getUserNotifications(userId);
    return list.filter((item) => item?.read !== true).length;
};

export const pushNotification = (payload) => {
    if (!payload?.userId) return [];
    const next = {
        id: payload.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: payload.createdAt || new Date().toISOString(),
        read: payload.read === true,
        ...payload,
    };
    const list = readNotifications();
    list.unshift(next);
    writeNotifications(list);
    return list;
};

export const markNotificationRead = (notificationId) => {
    if (!notificationId) return [];
    const list = readNotifications();
    const next = list.map((item) => (
        item.id === notificationId ? { ...item, read: true } : item
    ));
    writeNotifications(next);
    return next;
};

export const markAllNotificationsRead = (userId) => {
    if (!userId) return [];
    const list = readNotifications();
    const next = list.map((item) => (
        item?.userId === userId ? { ...item, read: true } : item
    ));
    writeNotifications(next);
    return next;
};

export const clearReadNotifications = (userId) => {
    if (!userId) return [];
    const list = readNotifications();
    const next = list.filter((item) => item?.userId !== userId || item?.read !== true);
    writeNotifications(next);
    return next;
};

export const clearAllNotifications = (userId) => {
    if (!userId) return [];
    const list = readNotifications();
    const next = list.filter((item) => item?.userId !== userId);
    writeNotifications(next);
    return next;
};

export const onNotificationsUpdated = (handler) => {
    if (typeof window === 'undefined') return () => { };
    const listener = () => handler?.();
    window.addEventListener('aw-notifications-updated', listener);
    return () => window.removeEventListener('aw-notifications-updated', listener);
};
