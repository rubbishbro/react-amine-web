//实现用户状态/登录登出上下文

import React, { createContext, useContext, useEffect, useState } from 'react';
import { buildUserId, createUuid, isSupportedUserId, mapLegacyUserId } from '../utils/userId';
import { buildTagInfo, readAdminMeta } from '../utils/adminMeta';
import { updateAuthorInCaches } from '../utils/postLoader';

const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

const defaultProfile = {
    name: '',
    school: '',
    className: '',
    email: '',
    avatar: '',
    cover: '',
    bio: '',
};

const ACCOUNTS_KEY = 'aw_accounts';

const normalizeLoginId = (value) => (value ?? '').toString().trim();

const isValidLoginId = (value) => {
    const trimmed = normalizeLoginId(value);
    return !!trimmed && trimmed.length <= 64 && !/\s/.test(trimmed);
};

const readAccounts = () => {
    try {
        const raw = localStorage.getItem(ACCOUNTS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writeAccounts = (accounts) => {
    try {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    } catch (error) {
        console.error('Failed to save accounts:', error);
    }
};

const hashPassword = async (password) => {
    if (!password) return '';
    try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const data = new TextEncoder().encode(password);
            const digest = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(digest))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
        }
    } catch (error) {
        console.error('Failed to hash password:', error);
    }
    let hash = 0;
    for (let i = 0; i < password.length; i += 1) {
        hash = (hash << 5) - hash + password.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
};

const attachTagInfo = (user) => {
    if (!user?.id) return user;
    const meta = readAdminMeta(user.id);
    const baseAuthor = { ...user, tagInfo: null, tag: null };
    const tagInfo = buildTagInfo(baseAuthor, meta);
    const hasSameTag =
        (user.tagInfo?.label || '') === (tagInfo?.label || '') &&
        (user.tagInfo?.variant || '') === (tagInfo?.variant || '');
    if (hasSameTag) return user;
    return { ...user, tagInfo };
};

export function UserProvider({ children }) {
    const getStorageKey = (type, userId) => `aw_${type}_${userId || 'guest'}`;

    const migrateUserId = (oldId, newId, displayName) => {
        if (!oldId || !newId || oldId === newId) return;

        const moveKey = (prefix) => {
            const oldKey = `aw_${prefix}_${oldId}`;
            const newKey = `aw_${prefix}_${newId}`;
            const raw = localStorage.getItem(oldKey);
            if (raw && !localStorage.getItem(newKey)) {
                localStorage.setItem(newKey, raw);
            }
            localStorage.removeItem(oldKey);
        };

        moveKey('likes');
        moveKey('favorites');

        const adminOldKey = `aw_admin_meta_${oldId}`;
        const adminNewKey = `aw_admin_meta_${newId}`;
        const adminRaw = localStorage.getItem(adminOldKey);
        if (adminRaw && !localStorage.getItem(adminNewKey)) {
            localStorage.setItem(adminNewKey, adminRaw);
        }
        localStorage.removeItem(adminOldKey);

        const blockOldKey = `aw_block_list_${oldId}`;
        const blockNewKey = `aw_block_list_${newId}`;
        const blockRaw = localStorage.getItem(blockOldKey);
        if (blockRaw && !localStorage.getItem(blockNewKey)) {
            localStorage.setItem(blockNewKey, blockRaw);
        }
        localStorage.removeItem(blockOldKey);

        try {
            const dmKeys = [];
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (key && key.startsWith('aw_dm_') && key.includes(oldId)) {
                    dmKeys.push(key);
                }
            }
            dmKeys.forEach((key) => {
                const ids = key.replace('aw_dm_', '').split('_');
                if (ids.length < 2) return;
                const mapped = ids.map((item) => (item === oldId ? newId : item));
                const nextKey = `aw_dm_${mapped.sort().join('_')}`;
                const raw = localStorage.getItem(key);
                if (raw && !localStorage.getItem(nextKey)) {
                    localStorage.setItem(nextKey, raw);
                }
                localStorage.removeItem(key);
            });
        } catch (error) {
            console.error('Failed to migrate DM threads:', error);
        }

        try {
            const followRaw = localStorage.getItem('aw_follow_graph');
            if (followRaw) {
                const graph = JSON.parse(followRaw) || {};
                const next = {};
                Object.entries(graph).forEach(([key, list]) => {
                    const nextKey = key === oldId ? newId : key;
                    const nextList = Array.isArray(list)
                        ? list.map((item) => (item === oldId ? newId : item))
                        : [];
                    next[nextKey] = nextList;
                });
                localStorage.setItem('aw_follow_graph', JSON.stringify(next));
            }
        } catch (error) {
            console.error('Failed to migrate follow graph:', error);
        }

        try {
            const repliesRaw = localStorage.getItem('aw_local_replies');
            if (repliesRaw) {
                const data = JSON.parse(repliesRaw) || {};
                Object.keys(data).forEach((postId) => {
                    const list = Array.isArray(data[postId]) ? data[postId] : [];
                    data[postId] = list.map((reply) => {
                        if (reply?.author?.id !== oldId) return reply;
                        return {
                            ...reply,
                            author: {
                                ...reply.author,
                                id: newId,
                            },
                        };
                    });
                });
                localStorage.setItem('aw_local_replies', JSON.stringify(data));
            }
        } catch (error) {
            console.error('Failed to migrate replies:', error);
        }

        if (displayName) {
            updateAuthorInCaches({
                id: newId,
                name: displayName,
            });
        }
    };

    const readList = (key) => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    const [user, setUser] = useState(() => {
        try {
            const raw = localStorage.getItem('aw_user');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed?.loggedIn !== true) return null;
            const profileName = parsed?.profile?.name || '游客';
            const storedId = parsed?.id || 'local';
            const normalizedId = buildUserId(profileName, storedId);
            const accounts = readAccounts();
            const rawLoginId = normalizeLoginId(parsed?.loginId || parsed?.profile?.name || '');
            let loginId = isValidLoginId(rawLoginId) ? rawLoginId : '';
            const existing = loginId ? (accounts[loginId] || {}) : {};
            const legacyAccountId = existing?.id || '';
            const legacyNormalizedId = normalizedId || '';
            const accountId = isSupportedUserId(legacyAccountId)
                ? mapLegacyUserId(legacyAccountId)
                : '';
            let nextId = isSupportedUserId(legacyNormalizedId)
                ? mapLegacyUserId(legacyNormalizedId)
                : '';
            if (accountId) nextId = accountId;
            if (!nextId) nextId = createUuid();
            if (!loginId) loginId = `user_${nextId.slice(0, 8)}`;

            if (legacyNormalizedId && legacyNormalizedId !== nextId) {
                migrateUserId(legacyNormalizedId, nextId, profileName);
            }
            if (legacyAccountId && legacyAccountId !== nextId) {
                migrateUserId(legacyAccountId, nextId, profileName);
            }

            const mergedProfile = {
                ...defaultProfile,
                ...(parsed.profile || {}),
                ...(existing.profile || {}),
            };
            const isAdmin = existing.isAdmin === true || parsed.isAdmin === true;

            accounts[loginId] = {
                ...existing,
                id: nextId,
                loginId,
                profile: mergedProfile,
                isAdmin,
                passwordHash: existing.passwordHash || '',
            };
            writeAccounts(accounts);
            return attachTagInfo({ ...parsed, id: nextId, loginId, isAdmin, profile: mergedProfile });
        } catch {
            return null;
        }
    });

    const [likes, setLikes] = useState(() => {
        return readList(getStorageKey('likes', 'guest'));
    });

    const [favorites, setFavorites] = useState(() => {
        return readList(getStorageKey('favorites', 'guest'));
    });

    useEffect(() => {
        const userId = user?.id || 'guest';
        setLikes(readList(getStorageKey('likes', userId)));
        setFavorites(readList(getStorageKey('favorites', userId)));
    }, [user?.id]);

    useEffect(() => {
        try {
            if (user?.loggedIn) localStorage.setItem('aw_user', JSON.stringify(user));
            else localStorage.removeItem('aw_user');
        } catch (e) {
            // 超限时移除头像再保存
            if (user?.loggedIn) {
                const safeUser = { ...user, profile: { ...user.profile, avatar: '' } };
                localStorage.setItem('aw_user', JSON.stringify(safeUser));
                setUser(safeUser);
            } else {
                localStorage.removeItem('aw_user');
            }
        }
    }, [user]);

    useEffect(() => {
        if (!user?.loggedIn || !user?.id) return;
        updateAuthorInCaches({
            id: user.id,
            name: user.profile?.name || '匿名',
            avatar: user.profile?.avatar || '',
            cover: user.profile?.cover || '',
            school: user.profile?.school || '',
            className: user.profile?.className || '',
            email: user.profile?.email || '',
            isAdmin: user.isAdmin === true,
            tagInfo: user.tagInfo || null,
        });
    }, [
        user?.id,
        user?.loggedIn,
        user?.isAdmin,
        user?.tagInfo,
        user?.profile?.name,
        user?.profile?.avatar,
        user?.profile?.cover,
        user?.profile?.school,
        user?.profile?.className,
        user?.profile?.email,
    ]);

    useEffect(() => {
        try {
            const userId = user?.id || 'guest';
            localStorage.setItem(getStorageKey('likes', userId), JSON.stringify(likes));
        } catch (e) {
            console.error('Error saving likes:', e);
        }
    }, [likes, user?.id]);

    useEffect(() => {
        try {
            const userId = user?.id || 'guest';
            localStorage.setItem(getStorageKey('favorites', userId), JSON.stringify(favorites));
        } catch (e) {
            console.error('Error saving favorites:', e);
        }
    }, [favorites, user?.id]);

    const login = async (payload) => {
        const loginId = normalizeLoginId(payload?.loginId || payload?.username);
        const password = payload?.password || '';
        if (!isValidLoginId(loginId)) {
            return { ok: false, message: '请输入有效的ID（不含空格）' };
        }
        if (!password || password.length < 8) {
            return { ok: false, message: '密码至少8位' };
        }
        const accounts = readAccounts();
        const existing = accounts[loginId];
        const passwordHash = await hashPassword(password);
        if (existing) {
            if (existing.passwordHash && existing.passwordHash !== passwordHash) {
                return { ok: false, message: '密码错误' };
            }
            const legacyId = existing.id;
            const mappedId = isSupportedUserId(legacyId) ? mapLegacyUserId(legacyId) : createUuid();
            if (legacyId && legacyId !== mappedId) {
                migrateUserId(legacyId, mappedId, existing?.profile?.name || '');
            }
            const nextAccount = {
                ...existing,
                loginId,
                id: mappedId,
                passwordHash: existing.passwordHash || passwordHash,
            };
            accounts[loginId] = nextAccount;
            writeAccounts(accounts);
            setUser(attachTagInfo({
                id: mappedId,
                loginId,
                loggedIn: true,
                isAdmin: nextAccount.isAdmin === true,
                profile: { ...defaultProfile, ...(nextAccount.profile || {}) },
            }));
            return { ok: true };
        }

        const nextId = createUuid();
        const profile = { ...defaultProfile };
        accounts[loginId] = {
            id: nextId,
            loginId,
            passwordHash,
            profile,
            isAdmin: false,
        };
        writeAccounts(accounts);
        setUser(attachTagInfo({ id: nextId, loginId, loggedIn: true, isAdmin: false, profile }));
        return { ok: true, isNew: true };
    };

    const updateProfile = async (profile) => {
        if (!user) return;
        const password = profile?.password || '';
        const mergedProfile = { ...defaultProfile, ...profile };
        delete mergedProfile.password;
        setUser((prev) => {
            if (!prev) return prev;
            const prevId = prev?.id || 'local';
            const resolvedId = mapLegacyUserId(prevId);
            const nextId = isSupportedUserId(resolvedId) ? resolvedId : createUuid();
            if (prevId !== nextId) {
                migrateUserId(prevId, nextId, mergedProfile.name);
            }
            return attachTagInfo({
                id: nextId,
                loginId: prev.loginId,
                loggedIn: true,
                isAdmin: prev?.isAdmin === true,
                profile: mergedProfile,
            });
        });

        const loginId = user?.loginId;
        if (!loginId) return;
        const accounts = readAccounts();
        const existing = accounts[loginId] || {};
        const resolvedId = mapLegacyUserId(existing.id || user?.id || '');
        const nextId = isSupportedUserId(resolvedId) ? resolvedId : (user?.id || createUuid());
        const nextAccount = {
            ...existing,
            id: nextId,
            loginId,
            profile: mergedProfile,
            isAdmin: user?.isAdmin === true,
        };
        if (password) {
            nextAccount.passwordHash = await hashPassword(password);
        } else {
            nextAccount.passwordHash = existing.passwordHash || '';
        }
        accounts[loginId] = nextAccount;
        writeAccounts(accounts);
    };

    const setAdmin = (isAdmin) => {
        setUser((prev) => {
            const mergedProfile = { ...defaultProfile, ...(prev?.profile || {}) };
            const prevId = prev?.id || 'local';
            const resolvedId = mapLegacyUserId(prevId);
            const nextId = isSupportedUserId(resolvedId) ? resolvedId : createUuid();
            if (prevId !== nextId) {
                migrateUserId(prevId, nextId, mergedProfile.name);
            }
            return attachTagInfo({
                id: nextId,
                loginId: prev?.loginId,
                loggedIn: true,
                isAdmin: !!isAdmin,
                profile: mergedProfile,
            });
        });
        const loginId = user?.loginId;
        if (!loginId) return;
        const accounts = readAccounts();
        const existing = accounts[loginId] || {};
        accounts[loginId] = {
            ...existing,
            id: mapLegacyUserId(existing.id || user?.id || '') || createUuid(),
            loginId,
            profile: { ...defaultProfile, ...(user?.profile || {}) },
            isAdmin: !!isAdmin,
            passwordHash: existing.passwordHash || '',
        };
        writeAccounts(accounts);
    };

    const logout = () => setUser(null);

    const toggleLike = (postId) => {
        if (!postId) return;
        setLikes((prev) => {
            if (prev.includes(postId)) {
                return prev.filter((id) => id !== postId);
            } else {
                return [...prev, postId];
            }
        });
    };

    const toggleFavorite = (postId) => {
        if (!postId) return;
        setFavorites((prev) => {
            if (prev.includes(postId)) {
                return prev.filter((id) => id !== postId);
            } else {
                return [...prev, postId];
            }
        });
    };

    const isLiked = (postId) => likes.includes(postId);

    const isFavorited = (postId) => favorites.includes(postId);

    return (
        <UserContext.Provider value={{
            user,
            login,
            logout,
            updateProfile,
            setAdmin,
            likes,
            favorites,
            toggleLike,
            toggleFavorite,
            isLiked,
            isFavorited
        }}>
            {children}
        </UserContext.Provider>
    );
}

export const isProfileComplete = (profile) => {
    if (!profile) return false;
    const { name, school, className, email } = profile;
    return !!(name && school && className && email);
};