import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { buildTagInfo, readAdminMeta } from '../utils/adminMeta';
import { updateAuthorInCaches } from '../utils/postLoader';
import {
  authHeaders as buildAuthHeaders,
  clearToken,
  fetchCurrentUser,
  readStoredToken,
  requestToken,
  saveToken,
} from '../../services/auth.js';

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

const USER_STORAGE_KEY = 'aw_user';
const EXTRA_PROFILE_PREFIX = 'aw_profile_';

const normalizeLoginId = (value) => (value ?? '').toString().trim();
const normalizePassword = (value) => (value ?? '').toString();

const normalizeExtraProfile = (profile = {}, fallbackEmail = '') => {
  const merged = { ...defaultProfile, ...profile };
  if (!merged.email && fallbackEmail) merged.email = fallbackEmail;
  return merged;
};

const readExtraProfile = (userId) => {
  if (!userId) return defaultProfile;
  try {
    const raw = localStorage.getItem(`${EXTRA_PROFILE_PREFIX}${userId}`);
    if (!raw) return defaultProfile;
    const parsed = JSON.parse(raw);
    return normalizeExtraProfile(parsed);
  } catch {
    return defaultProfile;
  }
};

const persistExtraProfile = (userId, profile) => {
  if (!userId) return;
  try {
    localStorage.setItem(`${EXTRA_PROFILE_PREFIX}${userId}`, JSON.stringify(profile));
  } catch (error) {
    console.error('Failed to cache profile extras', error);
  }
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

const normalizeBackendUser = (backendUser, extraProfile = defaultProfile) => {
  if (!backendUser) return null;
  const mergedProfile = normalizeExtraProfile(
    {
      ...extraProfile,
      name: backendUser.username || backendUser.email || extraProfile.name || '',
      email: backendUser.email || extraProfile.email || '',
    },
    backendUser.email,
  );
  return attachTagInfo({
    id: backendUser.id ? String(backendUser.id) : '',
    loginId: backendUser.username || backendUser.email || '',
    loggedIn: true,
    isAdmin: backendUser.is_superuser === true,
    profile: mergedProfile,
  });
};

const readCachedUser = () => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.loggedIn === true && parsed?.id) return parsed;
    return null;
  } catch {
    return null;
  }
};

const writeCachedUser = (user) => {
  try {
    if (user?.loggedIn) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to persist user cache', error);
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

export function UserProvider({ children }) {
  const initialToken = readStoredToken();
  const cachedUser = initialToken ? readCachedUser() : null;

  const [user, setUser] = useState(() => (cachedUser ? attachTagInfo(cachedUser) : null));
  const [authToken, setAuthToken] = useState(() => initialToken || '');

  const getStorageKey = (type, userId) => `aw_${type}_${userId || 'guest'}`;

  const [likes, setLikes] = useState(() => readList(getStorageKey('likes', 'guest')));
  const [favorites, setFavorites] = useState(() => readList(getStorageKey('favorites', 'guest')));

  const refreshUserFromBackend = useCallback(
    async (token) => {
      if (!token) return;
      const backendUser = await fetchCurrentUser(token);
      const extraProfile = readExtraProfile(backendUser?.id);
      const normalized = normalizeBackendUser(backendUser, extraProfile);
      if (!normalized) return;
      persistExtraProfile(normalized.id, normalized.profile);
      setUser(normalized);
    },
    [setUser],
  );

  // On token change, fetch the fresh user profile.
  useEffect(() => {
    if (!authToken) {
      setUser(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await refreshUserFromBackend(authToken);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to refresh user info:', error);
        clearToken();
        setAuthToken('');
        setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authToken, refreshUserFromBackend]);

  // Persist aw_user snapshot for legacy helpers (e.g., getCurrentViewerId).
  useEffect(() => {
    writeCachedUser(user);
  }, [user]);

  // Keep likes/favorites scoped to current user.
  useEffect(() => {
    const userId = user?.id || 'guest';
    setLikes(readList(getStorageKey('likes', userId)));
    setFavorites(readList(getStorageKey('favorites', userId)));
  }, [user?.id]);

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

  // Keep post caches in sync with the logged-in user.
  useEffect(() => {
    if (!user?.loggedIn || !user?.id) return;
    updateAuthorInCaches({
      id: user.id,
      name: user.profile?.name || '',
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

  const login = async (payload) => {
    const loginId = normalizeLoginId(payload?.loginId || payload?.username);
    const password = normalizePassword(payload?.password);
    const extraProfile = normalizeExtraProfile({
      school: payload?.school || '',
      className: payload?.className || '',
      email: payload?.email || '',
      bio: payload?.bio || '',
    });

    if (!loginId) {
      return { ok: false, message: '请输入用户名或学号' };
    }
    if (!password) {
      return { ok: false, message: '请输入密码' };
    }

    try {
      const token = await requestToken({ username: loginId, password });
      saveToken(token);
      setAuthToken(token);

      const backendUser = await fetchCurrentUser(token);
      const mergedProfile = normalizeExtraProfile(extraProfile, backendUser?.email);
      const normalized = normalizeBackendUser(backendUser, mergedProfile);
      persistExtraProfile(normalized?.id, mergedProfile);
      setUser(normalized);
      return { ok: true };
    } catch (error) {
      console.error('Login failed:', error);
      clearToken();
      setAuthToken('');
      setUser(null);
      return { ok: false, message: error?.message || '登录失败，请稍后重试' };
    }
  };

  const logout = () => {
    clearToken();
    setAuthToken('');
    setUser(null);
    setLikes(readList(getStorageKey('likes', 'guest')));
    setFavorites(readList(getStorageKey('favorites', 'guest')));
  };

  const updateProfile = async (profile) => {
    if (!user?.id) return;
    const mergedProfile = normalizeExtraProfile({ ...user.profile, ...profile }, user.profile?.email);
    persistExtraProfile(user.id, mergedProfile);
    setUser((prev) => (prev ? attachTagInfo({ ...prev, profile: mergedProfile }) : prev));
  };

  // Admin role is controlled by backend; keep as read-only to avoid confusion.
  const setAdmin = () => {
    console.warn('管理员权限由后端 is_superuser 字段控制，前端不再手动切换。');
  };

  const toggleLike = (postId) => {
    if (!postId) return;
    setLikes((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]));
  };

  const toggleFavorite = (postId) => {
    if (!postId) return;
    setFavorites((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]));
  };

  const isLiked = (postId) => likes.includes(postId);
  const isFavorited = (postId) => favorites.includes(postId);

  return (
    <UserContext.Provider
      value={{
        user,
        authToken,
        login,
        logout,
        updateProfile,
        setAdmin,
        likes,
        favorites,
        toggleLike,
        toggleFavorite,
        isLiked,
        isFavorited,
        authHeaders: () => buildAuthHeaders(authToken),
        refreshUser: () => refreshUserFromBackend(authToken),
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const isProfileComplete = (profile) => {
  if (!profile) return false;
  const { name, school, className, email } = profile;
  return !!(name && school && className && email);
};
