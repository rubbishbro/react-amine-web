//实现用户状态/登录登出上下文

import React, { createContext, useContext, useEffect, useState } from 'react';

const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

const defaultProfile = {
    name: '',
    school: '',
    className: '',
    email: '',
    avatar: '',
};

export function UserProvider({ children }) {
    const [user, setUser] = useState(() => {
        const raw = localStorage.getItem('aw_user');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.loggedIn === true ? parsed : null;
    });

    const [likes, setLikes] = useState(() => {
        try {
            const raw = localStorage.getItem('aw_likes');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    const [favorites, setFavorites] = useState(() => {
        try {
            const raw = localStorage.getItem('aw_favorites');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

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
            localStorage.setItem('aw_likes', JSON.stringify(likes));
        } catch (e) {
            console.error('Error saving likes:', e);
        }
    }, [likes]);

    useEffect(() => {
        try {
            localStorage.setItem('aw_favorites', JSON.stringify(favorites));
        } catch (e) {
            console.error('Error saving favorites:', e);
        }
    }, [favorites]);

    const login = async () => {
        setUser({ id: 'local', loggedIn: true, isAdmin: false, profile: { ...defaultProfile } });
    };

    const updateProfile = (profile) => {
        setUser((prev) => ({
            id: prev?.id || 'local',
            loggedIn: true,
            isAdmin: prev?.isAdmin === true,
            profile: { ...defaultProfile, ...profile },
        }));
    };

    const setAdmin = (isAdmin) => {
        setUser((prev) => ({
            id: prev?.id || 'local',
            loggedIn: true,
            isAdmin: !!isAdmin,
            profile: { ...defaultProfile, ...(prev?.profile || {}) },
        }));
    };

    const logout = () => setUser(null);

    const toggleLike = (postId) => {
        setLikes((prev) => {
            if (prev.includes(postId)) {
                return prev.filter((id) => id !== postId);
            } else {
                return [...prev, postId];
            }
        });
    };

    const toggleFavorite = (postId) => {
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