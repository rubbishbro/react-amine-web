import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UserContext } from './userContext.js';
import { buildTagInfo } from '../utils/adminMeta';
import { updateAuthorInCaches } from '../utils/postLoader';
import {
  clearToken,
  fetchCurrentUser,
  loginWithPassword,
  logoutSession,
  migrateLegacySession,
  readStoredToken,
  updateUserProfile,
} from '../../services/auth.js';
import { getMyInteractionStatus, togglePostLike, togglePostFavorite } from '../../services/interactApi.js';

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
      school: backendUser.userSchool || '',
      className: backendUser.userClass || '',
      bio: backendUser.bio || '',
      avatar: backendUser.avatar_url || '',
      cover: backendUser.cover_url || '',
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
  const cachedUser = readCachedUser();

  const [user, setUser] = useState(() => (cachedUser ? attachTagInfo(cachedUser) : null));

  const getStorageKey = (type, userId) => `aw_${type}_${userId || 'guest'}`;

  const [likes, setLikes] = useState(() => readList(getStorageKey('likes', 'guest')));
  const [favorites, setFavorites] = useState(() => readList(getStorageKey('favorites', 'guest')));
  // 标记是否已从后端拉取过最新数据，避免用户切换时重复请求
  const interactionSyncedRef = useRef('');

  const refreshUserFromBackend = useCallback(
    async () => {
      const backendUser = await fetchCurrentUser();
      const extraProfile = readExtraProfile(backendUser?.id);
      const normalized = normalizeBackendUser(backendUser, extraProfile);
      if (!normalized) return null;
      persistExtraProfile(normalized.id, normalized.profile);
      setUser(normalized);
      return normalized;
    },
    [setUser],
  );

  // Restore an HttpOnly Cookie session, migrating one legacy localStorage token once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const legacyToken = readStoredToken();
        let migratedUser = null;
        if (legacyToken) {
          try {
            migratedUser = await migrateLegacySession();
          } catch (error) {
            if (error?.status === 409) clearToken();
            else throw error;
          }
        }
        if (cancelled) return;
        if (migratedUser) {
          const normalized = normalizeBackendUser(migratedUser, readExtraProfile(migratedUser.id));
          persistExtraProfile(normalized.id, normalized.profile);
          setUser(normalized);
        } else {
          await refreshUserFromBackend();
        }
      } catch (error) {
        if (cancelled) return;
        if (error?.status === 401) {
          clearToken();
          setUser(null);
        } else {
          console.warn('暂时无法刷新用户信息，保留本地快照:', error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUserFromBackend]);

  useEffect(() => {
    const handleExpired = () => {
      clearToken();
      setUser(null);
    };
    window.addEventListener('aw:session-expired', handleExpired);
    return () => window.removeEventListener('aw:session-expired', handleExpired);
  }, []);

  // Persist aw_user snapshot for legacy helpers (e.g., getCurrentViewerId).
  useEffect(() => {
    writeCachedUser(user);
  }, [user]);

  // Keep likes/favorites scoped to current user.
  // 如果已登录且有 token，优先从后端拉取；否则 fallback 到 localStorage 缓存。
  useEffect(() => {
    const userId = user?.id || 'guest';
    let cancelled = false;
    // 未登录 → 直接读 localStorage（guest 缓存）
    if (!userId || userId === 'guest') {
      interactionSyncedRef.current = '';
      queueMicrotask(() => {
        if (cancelled) return;
        setLikes(readList(getStorageKey('likes', 'guest')));
        setFavorites(readList(getStorageKey('favorites', 'guest')));
      });
      return () => { cancelled = true; };
    }
    // 同一用户已同步过，跳过
    if (interactionSyncedRef.current === userId) return undefined;

    // 先用 localStorage 缓存做快照，避免白屏闪烁
    queueMicrotask(() => {
      if (cancelled) return;
      setLikes(readList(getStorageKey('likes', userId)));
      setFavorites(readList(getStorageKey('favorites', userId)));
    });

    // 再从后端拉取最新状态覆盖
    interactionSyncedRef.current = userId;
    getMyInteractionStatus()
      .then(({ liked_ids, favorited_ids }) => {
        if (cancelled) return;
        // 后端返回数字 ID，统一转 string 与前端保持一致
        const likedStrs = (liked_ids || []).map(String);
        const favoritedStrs = (favorited_ids || []).map(String);
        setLikes(likedStrs);
        setFavorites(favoritedStrs);
        // 同步写入本地缓存
        try {
          localStorage.setItem(getStorageKey('likes', userId), JSON.stringify(likedStrs));
          localStorage.setItem(getStorageKey('favorites', userId), JSON.stringify(favoritedStrs));
        } catch { /* ignore */ }
      })
      .catch((err) => {
        if (cancelled) return;
        // 后端失败时保留 localStorage 数据，不影响使用
        console.warn('[UserContext] 从后端同步点赞/收藏失败，使用本地缓存', err);
        interactionSyncedRef.current = ''; // 允许下次重试
      });
    return () => { cancelled = true; };
  }, [user?.id]);

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
    const loginIdentifier = normalizeEmail(payload?.identifier || payload?.email || payload?.loginId || payload?.username);
    const normalizedIdentifier = loginIdentifier.includes('@') ? loginIdentifier.toLowerCase() : loginIdentifier;
    const password = normalizePassword(payload?.password);
    const extraProfile = normalizeExtraProfile({
      school: payload?.school || '',
      className: payload?.className || '',
      email: normalizedIdentifier.includes('@') ? normalizedIdentifier : '',
      bio: payload?.bio || '',
    });

    if (!normalizedIdentifier) {
      return { ok: false, message: '请输入邮箱或用户名' };
    }
    if (!password) {
      return { ok: false, message: '请输入密码' };
    }

    try {
      const backendUser = await loginWithPassword({ identifier: normalizedIdentifier, password });
      const mergedProfile = normalizeExtraProfile(extraProfile, backendUser?.email);
      const normalized = normalizeBackendUser(backendUser, mergedProfile);
      persistExtraProfile(normalized?.id, normalized.profile);
      setUser(normalized);
      return { ok: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { ok: false, message: error?.message || '登录失败，请稍后重试' };
    }
  };

  const logout = async () => {
    try {
      await logoutSession();
    } catch (error) {
      console.warn('服务端退出失败，本地会话仍会清理:', error);
    }
    clearToken();
    setUser(null);
    setLikes(readList(getStorageKey('likes', 'guest')));
    setFavorites(readList(getStorageKey('favorites', 'guest')));
  };

  const updateProfile = async (profile) => {
    if (!user?.id) return;
    const mergedProfile = normalizeExtraProfile({ ...user.profile, ...profile }, user.profile?.email);
    const backendUser = await updateUserProfile(undefined, {
      username: mergedProfile.name,
      userSchool: mergedProfile.school,
      userClass: mergedProfile.className,
      bio: mergedProfile.bio,
      avatarUrl: mergedProfile.avatar,
      coverUrl: mergedProfile.cover,
    });
    const normalized = normalizeBackendUser(backendUser, mergedProfile);
    persistExtraProfile(user.id, normalized.profile);
    setUser(normalized);
    return normalized;
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
    if (!user?.loggedIn) return;
    try {
      const res = await togglePostLike(undefined, id);
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
  }, [user?.loggedIn]);

  const toggleFavorite = useCallback(async (postId) => {
    if (!postId) return;
    const id = String(postId);
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (!user?.loggedIn) return;
    try {
      const res = await togglePostFavorite(undefined, id);
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
  }, [user?.loggedIn]);

  const isLiked = (postId) => likes.includes(postId);
  const isFavorited = (postId) => favorites.includes(postId);

  return (
    <UserContext.Provider
      value={{
        user,
        isAuthenticated: user?.loggedIn === true,
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
        authHeaders: () => ({}),
        refreshUser: refreshUserFromBackend,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
