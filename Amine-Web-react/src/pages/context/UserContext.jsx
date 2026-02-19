import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { buildTagInfo } from '../utils/adminMeta';
import { updateAuthorInCaches } from '../utils/postLoader';
import {
  authHeaders as buildAuthHeaders,
  clearToken,
  fetchCurrentUser,
  readStoredToken,
  requestToken,
  saveToken,
} from '../../services/auth.js';
import { getMyInteractionStatus, togglePostLike, togglePostFavorite } from '../../services/interactApi.js';

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

const normalizeEmail = (value) => (value ?? '').toString().trim();
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
  // 直接用 user 自身的字段构建 tagInfo，不再读取 localStorage
  const baseAuthor = { ...user, tagInfo: null, tag: null };
  const tagInfo = buildTagInfo(baseAuthor, { title: user.title || '' });
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
      // 头像和头图：后端 URL 优先，如无则用本地缓存（未迁移时的降级）
      avatar: backendUser.avatar_url || extraProfile.avatar || '',
      cover: backendUser.cover_url || extraProfile.cover || '',
    },
    backendUser.email,
  );
  return attachTagInfo({
    id: backendUser.id ? String(backendUser.id) : '',
    loginId: backendUser.username || backendUser.email || '',
    loggedIn: true,
    isAdmin: backendUser.is_superuser === true,
    // 管理字段直接从后端映射，不再依赖 localStorage
    title: backendUser.title || '',
    isMuted: backendUser.is_muted === true,
    isBanned: backendUser.is_banned === true,
    muteCount: backendUser.mute_count ?? 0,
    banCount: backendUser.ban_count ?? 0,
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
  // 标记是否已从后端拉取过最新数据，避免用户切换时重复请求
  const interactionSyncedRef = useRef('');

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
  // 如果已登录且有 token，优先从后端拉取；否则 fallback 到 localStorage 缓存。
  useEffect(() => {
    const userId = user?.id || 'guest';
    // 未登录 → 直接读 localStorage（guest 缓存）
    if (!userId || userId === 'guest' || !authToken) {
      interactionSyncedRef.current = '';
      setLikes(readList(getStorageKey('likes', 'guest')));
      setFavorites(readList(getStorageKey('favorites', 'guest')));
      return;
    }
    // 同一用户已同步过，跳过
    if (interactionSyncedRef.current === userId) return;

    // 先用 localStorage 缓存做快照，避免白屏闪烁
    setLikes(readList(getStorageKey('likes', userId)));
    setFavorites(readList(getStorageKey('favorites', userId)));

    // 再从后端拉取最新状态覆盖
    interactionSyncedRef.current = userId;
    getMyInteractionStatus(authToken)
      .then(({ liked_ids, favorited_ids }) => {
        // 后端返回数字 ID，统一转 string 与前端保持一致
        const likedStrs = (liked_ids || []).map(String);
        const favoritedStrs = (favorited_ids || []).map(String);
        setLikes(likedStrs);
        setFavorites(favoritedStrs);
        // 同步写入本地缓存
        try {
          localStorage.setItem(getStorageKey('likes', userId), JSON.stringify(likedStrs));
          localStorage.setItem(getStorageKey('favorites', userId), JSON.stringify(favoritedStrs));
        } catch (_) { /* ignore */ }
      })
      .catch((err) => {
        // 后端失败时保留 localStorage 数据，不影响使用
        console.warn('[UserContext] 从后端同步点赞/收藏失败，使用本地缓存', err);
        interactionSyncedRef.current = ''; // 允许下次重试
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authToken]);

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
    const loginEmail = normalizeEmail(payload?.email || payload?.loginId || payload?.username);
    const password = normalizePassword(payload?.password);
    const extraProfile = normalizeExtraProfile({
      school: payload?.school || '',
      className: payload?.className || '',
      email: loginEmail,
      bio: payload?.bio || '',
    });

    if (!loginEmail) {
      return { ok: false, message: '请输入邮箱' };
    }
    if (!password) {
      return { ok: false, message: '请输入密码' };
    }

    try {
      const token = await requestToken({ username: loginEmail, password });
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

  const toggleLike = useCallback(async (postId) => {
    if (!postId) return;
    const id = String(postId);
    // 乐观更新
    setLikes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    // 已登录才调用后端
    if (!authToken) return;
    try {
      const res = await togglePostLike(authToken, id);
      // 用后端返回的真实状态同步
      setLikes((prev) => {
        if (res.liked) {
          return prev.includes(id) ? prev : [...prev, id];
        }
        return prev.filter((x) => x !== id);
      });
    } catch (err) {
      console.warn('[toggleLike] 后端失败，回滚到乐观状态', err);
      // 回滚：再切换一次
      setLikes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  }, [authToken]);

  const toggleFavorite = useCallback(async (postId) => {
    if (!postId) return;
    const id = String(postId);
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (!authToken) return;
    try {
      const res = await togglePostFavorite(authToken, id);
      setFavorites((prev) => {
        if (res.favorited) {
          return prev.includes(id) ? prev : [...prev, id];
        }
        return prev.filter((x) => x !== id);
      });
    } catch (err) {
      console.warn('[toggleFavorite] 后端失败，回滚到乐观状态', err);
      setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  }, [authToken]);

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
