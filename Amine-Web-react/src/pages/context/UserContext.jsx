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

    const login = async () => {
        setUser({ id: 'local', loggedIn: true, profile: { ...defaultProfile } });
    };

    const updateProfile = (profile) => {
        setUser((prev) => ({
            id: prev?.id || 'local',
            loggedIn: true,
            profile: { ...defaultProfile, ...profile },
        }));
    };

    const logout = () => setUser(null);

    return (
        <UserContext.Provider value={{ user, login, logout, updateProfile }}>
            {children}
        </UserContext.Provider>
    );
}

export const isProfileComplete = (profile) => {
    if (!profile) return false;
    const { name, school, className, email } = profile;
    return !!(name && school && className && email);
};