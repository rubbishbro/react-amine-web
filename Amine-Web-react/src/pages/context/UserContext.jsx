//实现用户状态/登录登出上下文

import React, { createContext, useContext, useEffect, useState } from 'react';
import { buildUserId } from '../utils/userId';

const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

const defaultProfile = {
    name: '',
    school: '',
    className: '',
    email: '',
    avatar: '',
    cover: '',
};

export function UserProvider({ children }) {
    const getStorageKey = (type, userId) => `aw_${type}_${userId || 'guest'}`;

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
            const normalizedId = buildUserId(profileName, parsed?.id || 'local');
            return { ...parsed, id: normalizedId };
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
        const name = payload?.username?.trim() || '';
        const profile = { ...defaultProfile, ...(name ? { name } : {}) };
        const nextId = buildUserId(profile.name, 'local');
        setUser({ id: nextId, loggedIn: true, isAdmin: false, profile });
    };

    const updateProfile = (profile) => {
        setUser((prev) => {
            const mergedProfile = { ...defaultProfile, ...profile };
            const nextId = buildUserId(mergedProfile.name, prev?.id || 'local');
            return {
                id: nextId,
                loggedIn: true,
                isAdmin: prev?.isAdmin === true,
                profile: mergedProfile,
            };
        });
    };

    const setAdmin = (isAdmin) => {
        setUser((prev) => {
            const mergedProfile = { ...defaultProfile, ...(prev?.profile || {}) };
            const nextId = buildUserId(mergedProfile.name, prev?.id || 'local');
            return {
                id: nextId,
                loggedIn: true,
                isAdmin: !!isAdmin,
                profile: mergedProfile,
            };
        });
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