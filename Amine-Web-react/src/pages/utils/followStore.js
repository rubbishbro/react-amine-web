/**
 * followStore.js
 *
 * ⚠️ 迁移说明：
 *   - 关注/粉丝数据已迁移至后端，通过 services/relationsApi.js 持久化
 *   - 本文件提供两套 API：
 *     1. 本地缓存（同步）—— 用于 UI 初始值展示（快速渲染），数据来自上次后端同步
 *     2. 后端 API（异步）—— 用于真正的关注/取关操作
 *   - localStorage `aw_follow_graph` 已废弃，不再写入新数据；仅作旧数据降级读取
 */
import {
  followUser,
  unfollowUser,
  getUserRelationStats,
  getRelationStatus,
} from '../../services/relationsApi.js';

// ─── 本地缓存键（只读，不再写入） ──────────────────────
const FOLLOW_CACHE_KEY = 'aw_follow_cache'; // { [targetId]: { followerCount, followingIds } }

const readCache = () => {
  try {
    const raw = localStorage.getItem(FOLLOW_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeCache = (data) => {
  try {
    localStorage.setItem(FOLLOW_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
};

// ─── 后端同步：将真实数据写入本地缓存 ─────────────────
/**
 * 从后端拉取目标用户的关注数据并同步到本地缓存
 * @param {string|number} targetId - 目标用户后端 ID
 * @param {string} [token] - 当前用户 token（用于查询是否已关注）
 * @param {string|number} [viewerId] - 当前用户后端 ID（用于本地缓存 isFollowing）
 * @returns {Promise<{ followerCount: number, isFollowing: boolean }>}
 */
export const syncFollowFromBackend = async (targetId, token = '', viewerId = '') => {
  if (!targetId) return { followerCount: 0, isFollowing: false };
  try {
    const [statsRes, relationRes] = await Promise.allSettled([
      getUserRelationStats(targetId),
      token && viewerId && String(viewerId) !== String(targetId)
        ? getRelationStatus(token, targetId)
        : Promise.resolve(null),
    ]);
    const followerCount = statsRes.status === 'fulfilled' ? (statsRes.value.follower_count ?? 0) : 0;
    const isFollowing = relationRes.status === 'fulfilled' && relationRes.value
      ? (relationRes.value.is_following === true)
      : false;

    // 写入本地缓存
    const cache = readCache();
    cache[String(targetId)] = { followerCount, isFollowing, viewerId: String(viewerId) };
    writeCache(cache);

    return { followerCount, isFollowing };
  } catch (err) {
    console.warn('[followStore] syncFollowFromBackend 失败:', err.message);
    return { followerCount: 0, isFollowing: false };
  }
};

// ─── 同步读缓存（用于 useMemo 初始值） ─────────────────
/**
 * 从本地缓存读取粉丝数（初始值，不保证最新）
 * 调用方应在 useEffect 中调用 syncFollowFromBackend 获取真实值
 */
export const getFollowerCount = (targetId) => {
  if (!targetId) return 0;
  const cache = readCache();
  return cache[String(targetId)]?.followerCount ?? 0;
};

/**
 * 从本地缓存读取是否已关注（初始值，不保证最新）
 * 调用方应在 useEffect 中调用 syncFollowFromBackend 获取真实值
 */
export const isFollowingUser = (_followerId, targetId) => {
  if (!targetId) return false;
  const cache = readCache();
  return cache[String(targetId)]?.isFollowing === true;
};

// ─── 异步操作（调用后端 + 更新本地缓存） ───────────────
/**
 * 切换关注状态（调用后端 API 并更新本地缓存）
 * @param {string} token - 登录 token
 * @param {string|number} viewerId - 当前用户后端 ID
 * @param {string|number} targetId - 目标用户后端 ID
 * @returns {Promise<{ isFollowing: boolean, followerCount: number }>}
 */
export const toggleFollowUser = async (token, viewerId, targetId) => {
  if (!token || !viewerId || !targetId || String(viewerId) === String(targetId)) {
    return { isFollowing: false, followerCount: getFollowerCount(targetId) };
  }
  const currentlyFollowing = isFollowingUser(viewerId, targetId);
  try {
    if (currentlyFollowing) {
      await unfollowUser(token, targetId);
    } else {
      await followUser(token, targetId);
    }
    const nextFollowing = !currentlyFollowing;
    const cache = readCache();
    const prevCount = cache[String(targetId)]?.followerCount ?? 0;
    const nextCount = Math.max(0, prevCount + (nextFollowing ? 1 : -1));
    cache[String(targetId)] = { followerCount: nextCount, isFollowing: nextFollowing, viewerId: String(viewerId) };
    writeCache(cache);
    return { isFollowing: nextFollowing, followerCount: nextCount };
  } catch (err) {
    throw err;
  }
};

/**
 * @deprecated 已迁移至后端，不再维护本地关系图
 * 保留空实现以避免旧调用处报错
 */
export const removeFollowRelation = (_viewerId, _targetId) => {
  // no-op: 关注关系由后端管理
};
