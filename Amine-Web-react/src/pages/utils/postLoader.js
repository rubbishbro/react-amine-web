import { getCategoryColor } from '../config/colors.js';
import { isUserBanned } from './adminMeta.js';
import { isBlocked } from './blockStore.js';
import { ensurePostReadTime } from './postReadTime.js';
import { buildUserId, getCurrentViewerId } from './userId.js';
import { API_BASE_URL, resolveMediaUrl } from '../config/api.js';
import { readStoredToken } from '../../services/auth.js';

const LOCAL_POSTS_KEY = 'aw_local_posts';
const REMOTE_POSTS_CACHE_KEY = 'aw_posts_cache';
const REMOTE_POSTS_CACHE_TIMESTAMP_KEY = 'aw_posts_cache_timestamp';
const LOCAL_DELETED_POSTS_KEY = 'aw_deleted_posts';
const LOCAL_PINNED_POSTS_KEY = 'aw_pinned_posts';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 缓存过期时间：5分钟

const defaultAuthor = {
  id: 'anonymous',
  name: '匿名',
  avatar: '',
  school: '',
  className: '',
  email: '',
  isAdmin: false,
};

const normalizeAuthor = (author) => {
  if (!author) return { ...defaultAuthor };

  if (typeof author === 'string') {
    const name = author.trim() || defaultAuthor.name;
    const id = encodeURIComponent(name) || defaultAuthor.id;
    return { ...defaultAuthor, id, name };
  }

  const rawName = (author.name || author.username || author.userName || author.nickname || author.nickName || '').trim();
  const name = rawName || defaultAuthor.name;
  const normalizedId = author.id || author.userId || '';
  const safeId = normalizedId && normalizedId !== 'local' && normalizedId !== 'guest'
    ? normalizedId
    : '';
  const id = safeId || encodeURIComponent(name) || defaultAuthor.id;
  const tagInfo = author.tagInfo || author.tag || null;

  return {
    ...defaultAuthor,
    ...author,
    id,
    name,
    avatar: resolveMediaUrl(author.avatar || author.avatarUrl || author.avatarURL || author.avatar_url),
    cover: resolveMediaUrl(author.cover || author.coverUrl || author.coverURL || author.cover_url),
    school: author.school || author.college || author.userSchool || '',
    className: author.className || author.class || author.grade || author.userClass || '',
    email: author.email || '',
    isAdmin: author.isAdmin === true || author.is_superuser === true,
    tagInfo,
  };
};

const isDraftPost = (post) => post?.isDraft === true || post?.status === 'draft';

const getDraftOwnerId = (post) => {
  if (!post) return '';
  if (post.draftOwnerId) return String(post.draftOwnerId);
  const normalizedAuthor = normalizeAuthor(post.author);
  return normalizedAuthor?.id ? String(normalizedAuthor.id) : '';
};

const canViewerAccessDraft = (post, viewerId = getCurrentViewerId()) => {
  if (!isDraftPost(post)) return true;
  if (!viewerId) return false;
  return getDraftOwnerId(post) === String(viewerId);
};

/**
 * 将后端帖子格式转换为前端期望的格式
 */
const transformBackendPost = (backendPost) => {
  if (!backendPost) return null;
  
  return {
    id: String(backendPost.id), // 后端是数字，前端期望字符串
    title: backendPost.title || '',
    content: backendPost.content || '',
    summary: backendPost.summary || '',
    category: backendPost.category || '',
    tags: Array.isArray(backendPost.tags) ? backendPost.tags : [],
    date: backendPost.created_at || backendPost.updated_at || new Date().toISOString(),
    author: normalizeAuthor(backendPost.author),
    status: backendPost.is_published ? 'published' : 'draft',
    isPinnedGlobally: false, // 后端暂无此字段
    pinnedInCategories: [],
    order: 999,
  };
};

const readRemotePostsCache = () => {
  try {
    const raw = localStorage.getItem(REMOTE_POSTS_CACHE_KEY);
    const timestamp = localStorage.getItem(REMOTE_POSTS_CACHE_TIMESTAMP_KEY);
    
    if (!raw) return [];
    
    // 检查缓存是否过期
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age > CACHE_EXPIRY_MS) {
        console.log('🔄 缓存已过期，将从服务器重新获取数据');
        // 清除过期缓存
        localStorage.removeItem(REMOTE_POSTS_CACHE_KEY);
        localStorage.removeItem(REMOTE_POSTS_CACHE_TIMESTAMP_KEY);
        return [];
      }
      console.log(`✅ 使用缓存数据（还剩 ${Math.floor((CACHE_EXPIRY_MS - age) / 1000)} 秒过期）`);
    }
    
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading remote posts cache:', error);
    return [];
  }
};

const writeRemotePostsCache = (posts) => {
  try {
    localStorage.setItem(REMOTE_POSTS_CACHE_KEY, JSON.stringify(posts));
    localStorage.setItem(REMOTE_POSTS_CACHE_TIMESTAMP_KEY, Date.now().toString());
    console.log(`💾 缓存已更新，共 ${posts.length} 条帖子`);
  } catch (error) {
    console.error('Error writing remote posts cache:', error);
  }
};

export const cacheRemotePost = (post) => {
  const transformed = transformBackendPost(post);
  if (!transformed?.id) return null;

  const cached = readRemotePostsCache();
  const index = cached.findIndex((item) => item.id === transformed.id);
  if (index >= 0) {
    cached[index] = transformed;
  } else {
    cached.unshift(transformed);
  }
  writeRemotePostsCache(cached);
  return transformed;
};

const filterVisiblePosts = (posts) => {
  const viewerId = getCurrentViewerId();

  return posts.filter((post) => {
    if (!post) return false;
    const normalizedAuthor = normalizeAuthor(post.author);
    const authorId = normalizedAuthor?.id || buildUserId(normalizedAuthor?.name || '', '');
    if (viewerId && authorId) {
      if (isBlocked(authorId, viewerId)) return false;
      if (isBlocked(viewerId, authorId)) return false;
    }
    if (authorId && isUserBanned(authorId)) return false;
    return true;
  });
};

// 从后端 API 获取帖子列表（批量拉取全部，用于个人主页/搜索等）
export const fetchPostsFromBackend = async () => {
  try {
    const PostAPI = (await import('../../services/getpostfromback.js')).default;
    const api = new PostAPI();
    const pageSize = 100;
    let skip = 0;
    let total = 0;
    const rawPosts = [];

    while (true) {
      const result = await api.getPostsLists({ skip, limit: pageSize });
      const items = Array.isArray(result?.items) ? result.items : [];
      total = Number.isFinite(result?.total) ? result.total : total;
      rawPosts.push(...items);

      if (items.length < pageSize) break;
      if (total > 0 && skip + pageSize >= total) break;
      skip += pageSize;
    }

    const transformedPosts = rawPosts
      .map((post) => transformBackendPost(post))
      .filter((post) => post !== null);

    if (transformedPosts.length > 0) {
      writeRemotePostsCache(transformedPosts);
    }

    return transformedPosts;
  } catch (error) {
    console.error('Error fetching posts from backend:', error);
    return readRemotePostsCache();
  }
};

export const fetchPostsPageFromBackend = async ({ skip = 0, limit = 20, category = null } = {}) => {
  try {
    const PostAPI = (await import('../../services/getpostfromback.js')).default;
    const api = new PostAPI();
    const result = await api.getPostsLists({ skip, limit, category });
    const items = Array.isArray(result?.items) ? result.items : [];
    const total = Number.isFinite(result?.total) ? result.total : items.length;
    const transformedPosts = items
      .map((post) => transformBackendPost(post))
      .filter((post) => post !== null);

    if (transformedPosts.length > 0) {
      const cached = readRemotePostsCache();
      const merged = new Map();
      cached.forEach((post) => merged.set(post.id, post));
      transformedPosts.forEach((post) => merged.set(post.id, post));
      writeRemotePostsCache(Array.from(merged.values()));
    }

    return { posts: transformedPosts, total, skip, limit };
  } catch (error) {
    console.error('Error fetching paged posts from backend:', error);
    return { posts: [], total: 0, skip, limit };
  }
};

const readLocalPosts = () => {
  try {
    const raw = localStorage.getItem(LOCAL_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading local posts:', error);
    return [];
  }
};

const writeLocalPosts = (posts) => {
  try {
    localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(posts));
  } catch (error) {
    console.error('Error writing local posts:', error);
  }
};

const readDeletedPosts = () => {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading deleted posts:', error);
    return [];
  }
};

const writeDeletedPosts = (ids) => {
  try {
    localStorage.setItem(LOCAL_DELETED_POSTS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error('Error writing deleted posts:', error);
  }
};

export const clearDeletedPostMarker = (postId) => {
  if (!postId) return;
  const ids = readDeletedPosts();
  const nextIds = ids.filter((id) => id !== postId);
  if (nextIds.length !== ids.length) {
    writeDeletedPosts(nextIds);
  }
};

const readPinnedPosts = () => {
  try {
    const raw = localStorage.getItem(LOCAL_PINNED_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading pinned posts:', error);
    return [];
  }
};

const writePinnedPosts = (ids) => {
  try {
    localStorage.setItem(LOCAL_PINNED_POSTS_KEY, JSON.stringify(ids));
  } catch (error) {
    console.error('Error writing pinned posts:', error);
  }
};

export const markPostDeleted = (postId) => {
  clearDeletedPostMarker(postId);
  const posts = readLocalPosts();
  const nextPosts = posts.filter((item) => item.id !== postId);
  if (nextPosts.length !== posts.length) {
    writeLocalPosts(nextPosts);
  }
};

export const removeRemotePostFromCache = (postId) => {
  if (!postId) return;
  const cachedPosts = readRemotePostsCache();
  const nextCachedPosts = cachedPosts.filter((item) => item?.id !== postId);
  if (nextCachedPosts.length !== cachedPosts.length) {
    writeRemotePostsCache(nextCachedPosts);
  }
};

export const deletePublishedPost = async (postId, token = '') => {
  const resolvedToken = token || readStoredToken();
  if (!resolvedToken) {
    throw new Error('登录状态已失效，请重新登录后删除帖子');
  }

  const PostAPI = (await import('../../services/getpostfromback.js')).default;
  const api = new PostAPI();

  try {
    const deletedPost = await api.deletePost(postId, resolvedToken);
    removeRemotePostFromCache(postId);
    clearDeletedPostMarker(postId);
    clearPostsCache();
    return deletedPost;
  } catch (error) {
    if (error?.status === 404) {
      removeRemotePostFromCache(postId);
      clearDeletedPostMarker(postId);
      clearPostsCache();
      return null;
    }
    throw error;
  } finally {
  const posts = readLocalPosts();
  const nextPosts = posts.filter((item) => item.id !== postId);
    if (nextPosts.length !== posts.length) {
      writeLocalPosts(nextPosts);
    }
  }
};

export const isPostPinnedLocally = (postId) => {
  const ids = readPinnedPosts();
  return ids.includes(postId);
};

export const setPostPinnedLocally = (postId, isPinned) => {
  const ids = readPinnedPosts();
  const exists = ids.includes(postId);
  if (isPinned && !exists) {
    ids.push(postId);
    writePinnedPosts(ids);
  }
  if (!isPinned && exists) {
    const next = ids.filter((id) => id !== postId);
    writePinnedPosts(next);
  }
};

export const upsertLocalPost = (postData) => {
  const normalized = {
    ...postData,
    author: normalizeAuthor(postData.author),
  };
  
  // 如果帖子是已发布状态，不保存到本地（应该在后端）
  const isPublished = normalized.status === 'published' || normalized.is_published === true;
  if (isPublished) {
    console.warn('尝试保存已发布帖子到本地存储，已忽略。已发布帖子应存储在后端。');
    // 如果本地有这个 ID 的帖子，删除它
    const posts = readLocalPosts();
    const filtered = posts.filter((item) => item.id !== normalized.id);
    if (filtered.length !== posts.length) {
      writeLocalPosts(filtered);
    }
    return normalized;
  }
  
  const posts = readLocalPosts();
  const index = posts.findIndex((item) => item.id === normalized.id);
  if (index >= 0) {
    posts[index] = { ...posts[index], ...normalized };
  } else {
    posts.unshift(normalized);
  }
  writeLocalPosts(posts);
  return normalized;
};

export const saveLocalDraft = (postData) => {
  const normalizedAuthor = normalizeAuthor(postData.author);
  const draftOwnerId = postData.draftOwnerId || normalizedAuthor.id || getCurrentViewerId() || '';
  return upsertLocalPost({
    ...postData,
    author: normalizedAuthor,
    draftOwnerId,
    status: 'draft',
    isDraft: true,
    is_published: false,
  });
};

export const removeLocalDraft = (postId) => {
  if (!postId) return;
  const posts = readLocalPosts();
  const nextPosts = posts.filter((item) => item.id !== postId);
  if (nextPosts.length !== posts.length) {
    writeLocalPosts(nextPosts);
  }
};

export const replaceDraftAfterPublish = (draftId, backendPost) => {
  const cached = cacheRemotePost(backendPost);
  if (draftId) {
    removeLocalDraft(draftId);
  }
  return cached;
};

export const publishLocalDraft = async (postData, token = '') => {
  const resolvedToken = token || readStoredToken();
  if (!resolvedToken) {
    throw new Error('登录已失效，请重新登录后发布');
  }

  const PostAPI = (await import('../../services/getpostfromback.js')).default;
  const api = new PostAPI();
  const created = await api.createPost(postData, resolvedToken);

  if (!created?.id) {
    throw new Error('发布失败：后端未返回帖子 ID');
  }

  return replaceDraftAfterPublish(postData?.id, created) || transformBackendPost(created);
};

const getLocalPostById = (postId) => {
  const posts = readLocalPosts();
  const matched = posts.find((item) => item.id === postId) || null;
  if (!matched) return null;
  return canViewerAccessDraft(matched) ? matched : null;
};

const getCachedPostById = (postId) => {
  const posts = readRemotePostsCache();
  return posts.find((item) => item.id === postId) || null;
};

/**
 * 获取本地草稿帖子（未发布的）
 * 已发布的帖子应该在后端，不应出现在本地存储中
 */
const getLocalDraftPosts = () => {
  const posts = readLocalPosts();
  const viewerId = getCurrentViewerId();
  if (!viewerId) return [];
  return posts.filter((item) => {
    if (!canViewerAccessDraft(item, viewerId)) return false;
    // 只返回草稿状态的帖子
    const isPublished = item.status === 'published' || item.is_published === true;
    return !isPublished;
  });
};

/**
 * 清理本地存储中已发布的帖子
 * 已发布的帖子应该从后端获取，不应保留在本地
 */
export const cleanPublishedLocalPosts = () => {
  try {
    const posts = readLocalPosts();
    const draftPosts = posts.filter((item) => {
      const isPublished = item.status === 'published' || item.is_published === true;
      return !isPublished; // 只保留未发布的
    });
    
    const removedCount = posts.length - draftPosts.length;
    if (removedCount > 0) {
      writeLocalPosts(draftPosts);
      console.log(`已清理 ${removedCount} 个已发布的本地帖子`);
    }
    
    return removedCount;
  } catch (error) {
    console.error('清理本地已发布帖子失败:', error);
    return 0;
  }
};

const applyPinned = (post, pinnedIds) => ensurePostReadTime({
  ...post,
  author: normalizeAuthor(post.author),
  isPinnedGlobally: post.isPinnedGlobally === true || pinnedIds.includes(post.id),
  pinnedInCategories: post.pinnedInCategories || (pinnedIds.includes(post.id) ? ['全站'] : []),
  order: post.order || 999,
});

const buildMergedPosts = () => {
  const pinnedIds = readPinnedPosts();
  const merged = new Map();
  
  // 1. 添加后端帖子（已发布的）
  const cachedPosts = readRemotePostsCache();
  cachedPosts.forEach((post) => {
    if (!post) return;
    merged.set(post.id, applyPinned(post, pinnedIds));
  });

  // 2. 添加本地草稿帖子（仅未发布的）
  const localDrafts = getLocalDraftPosts();
  localDrafts.forEach((post) => {
    // 为草稿添加标识
    const draftPost = { ...post, isDraft: true, status: 'draft', is_published: false };
    merged.set(post.id, applyPinned(draftPost, pinnedIds));
  });

  return Array.from(merged.values());
};

/**
 * 加载帖子元数据（仅包含置顶和排序信息）
 * 当前从缓存读取，保留后端接口以便日后接入
 */
export const loadPostMetadata = async () => {
  const merged = buildMergedPosts();
  return merged.map((post) => ({
    id: post.id,
    pinnedIn: post.pinnedInCategories || (post.isPinnedGlobally ? ['全站'] : []),
    order: post.order || 999,
  }));
};

/**
 * 加载单个帖子的详细内容
 * @param {string} postId - 帖子ID
 */
export const loadPostContent = async (postId) => {
  try {
    // 1. 优先查找本地帖子（草稿等）
    const localPost = getLocalPostById(postId);
    if (localPost) {
      return applyPinned({ ...localPost, isDraft: true, status: 'draft', is_published: false }, readPinnedPosts());
    }
    
    // 2. 从后端 API 获取
    try {
      const PostAPI = (await import('../../services/getpostfromback.js')).default;
      const api = new PostAPI();
      const rawPost = await api.getPostById(postId);
      
      if (rawPost) {
        const transformedPost = transformBackendPost(rawPost);
        if (transformedPost) {
          cacheRemotePost(rawPost);
          return applyPinned(transformedPost, readPinnedPosts());
        }
      }
    } catch (apiError) {
      console.warn(`Failed to fetch post ${postId} from backend, trying cache:`, apiError.message);
    }
    
    // 3. 最后尝试从缓存获取
    const cachedPost = getCachedPostById(postId);
    if (!cachedPost) return null;
    return applyPinned({ ...cachedPost, id: postId }, readPinnedPosts());
  } catch (error) {
    console.error(`Error loading post ${postId}:`, error);
    return null;
  }
};

/**
 * 清除帖子缓存（手动刷新时使用）
 */
export const clearPostsCache = () => {
  try {
    localStorage.removeItem(REMOTE_POSTS_CACHE_KEY);
    localStorage.removeItem(REMOTE_POSTS_CACHE_TIMESTAMP_KEY);
    console.log('🗑️ 帖子缓存已清除');
    return true;
  } catch (error) {
    console.error('清除缓存失败:', error);
    return false;
  }
};

/**
 * 加载所有帖子的完整数据
 * @param {boolean} forceRefresh - 强制刷新，忽略缓存
 */
export const loadAllPosts = async (forceRefresh = false) => {
  try {
    // 如果是强制刷新，清除缓存
    if (forceRefresh) {
      clearPostsCache();
      console.log('🔄 强制刷新：从服务器获取最新数据');
    }
    
    // 首先清理本地已发布的帖子
    cleanPublishedLocalPosts();
    
    // 然后从后端获取最新数据
    await fetchPostsFromBackend();
    
    const validPosts = filterVisiblePosts(buildMergedPosts());

    const sortedPosts = validPosts.sort((a, b) => {
      if (a.isPinnedGlobally && !b.isPinnedGlobally) return -1;
      if (!a.isPinnedGlobally && b.isPinnedGlobally) return 1;
      if (a.isPinnedGlobally && b.isPinnedGlobally) {
        return (a.order || 999) - (b.order || 999);
      }
      return new Date(b.date) - new Date(a.date);
    });

    return sortedPosts.map((post) => ({
      ...post,
      isPinnedInCurrentCategory: post.pinnedInCategories?.includes('全站') || false
    }));
  } catch (error) {
    console.error('Error loading all posts:', error);
    return [];
  }
};

export const loadPostsPage = async ({ page = 1, pageSize = 5, category = null, forceRefresh = false } = {}) => {
  try {
    if (forceRefresh) {
      clearPostsCache();
    }

    cleanPublishedLocalPosts();

    const skip = Math.max(page - 1, 0) * pageSize;
    const { posts: remotePosts, total: remoteTotal } = await fetchPostsPageFromBackend({
      skip,
      limit: pageSize,
      category,
    });

    const pinnedIds = readPinnedPosts();
    const normalizedRemote = remotePosts.map((post) => applyPinned(post, pinnedIds));

    let localDrafts = [];
    if (page === 1) {
      localDrafts = getLocalDraftPosts()
        .filter((post) => {
          if (!category || category === 'all' || category === '全部') return true;
          return post.category === category;
        })
        .map((post) => applyPinned({ ...post, isDraft: true }, pinnedIds));
    }

    const combined = [...localDrafts, ...normalizedRemote].map((post) => ({
      ...post,
      isPinnedInCurrentCategory: category && category !== 'all'
        ? post.isPinnedGlobally || (post.pinnedInCategories || []).includes(category)
        : post.isPinnedGlobally,
    }));

    const visiblePosts = filterVisiblePosts(combined);

    return {
      posts: visiblePosts,
      remoteTotal,
      localDraftCount: localDrafts.length,
      remoteCount: normalizedRemote.length,
    };
  } catch (error) {
    console.error('Error loading paged posts:', error);
    return { posts: [], remoteTotal: 0, localDraftCount: 0, remoteCount: 0 };
  }
};

/**
 * 获取帖子在指定分类中的置顶状态
 */
const isPinnedInCategory = (postMetadata, category) => {
  if (!postMetadata || !category || category === 'all' || category === '全部') {
    return postMetadata?.pinnedIn?.length > 0;
  }
  return postMetadata?.pinnedIn?.includes(category) || false;
};

/**
 * 按分类加载帖子
 */
export const loadPostsByCategory = async (category) => {
  try {
    const allPosts = await loadAllPosts();

    if (!category || category === 'all' || category === '全部') {
      return allPosts;
    }

    const filteredPosts = allPosts.filter((post) => post.category === category);
    const postsWithPinnedStatus = filteredPosts.map((post) => ({
      ...post,
      isPinnedInCurrentCategory: post.isPinnedGlobally || post.pinnedInCategories.includes(category)
    }));

    return postsWithPinnedStatus.sort((a, b) => {
      if (a.isPinnedInCurrentCategory && !b.isPinnedInCurrentCategory) return -1;
      if (!a.isPinnedInCurrentCategory && b.isPinnedInCurrentCategory) return 1;
      if (a.order !== b.order) return a.order - b.order;
      return new Date(b.date) - new Date(a.date);
    });
  } catch (error) {
    console.error(`Error loading posts by category ${category}:`, error);
    return [];
  }
};

/**
 * 获取帖子在指定分类中的置顶状态
 */
export const getPostPinnedStatus = async (postId, category) => {
  try {
    const metadataList = await loadPostMetadata();
    const postMetadata = metadataList.find((m) => m.id === postId);
    return isPinnedInCategory(postMetadata, category);
  } catch (error) {
    console.error(`Error getting pinned status for post ${postId}:`, error);
    return false;
  }
};

/**
 * 获取帖子在所有分类中的置顶状态
 */
export const getPostPinnedCategories = async (postId) => {
  try {
    const metadataList = await loadPostMetadata();
    const postMetadata = metadataList.find((m) => m.id === postId);
    return postMetadata?.pinnedIn || [];
  } catch (error) {
    console.error(`Error getting pinned categories for post ${postId}:`, error);
    return [];
  }
};

/**
 * 获取分类的显示名称（直接返回中文）
 */
export const getCategoryDisplayName = (category) => {
  if (!category) return '未分类';
  return category;
};

/**
 * 获取所有可用的分类（中文）- 固定列表
 */
export const getAllCategories = async () => {
  const fixedCategories = [
    '季度新番',
    '论坛闲聊',
    '社团活动',
    '同人/杂谈',
    '前沿技术',
    '网络资源',
    '音游区',
    '网站开发'
  ];

  return fixedCategories.map((cat) => ({
    id: cat,
    name: cat
  }));
};

/**
 * 按多个中文分类加载帖子
 */
export const loadPostsByCategories = async (categories) => {
  try {
    const allPosts = await loadAllPosts();

    if (!categories || categories.length === 0) {
      return allPosts;
    }

    const filteredPosts = allPosts.filter((post) => post.category && categories.includes(post.category));
    return filteredPosts;
  } catch (error) {
    console.error('Error loading posts by categories:', error);
    return [];
  }
};

/**
 * 获取分类对应的颜色
 */
export const getPostCategoryColor = (category) => {
  return getCategoryColor(category);
};

const normalizeValue = (value) => (value ?? '').toString().trim().toLowerCase();

const matchesAuthor = (author, target) => {
  if (!author || !target) return false;
  const targetId = normalizeValue(target.id);
  const targetName = normalizeValue(target.name);

  if (typeof author === 'string') {
    const authorName = normalizeValue(author);
    return (targetName && authorName === targetName) || (targetId && authorName === targetId);
  }

  const authorId = normalizeValue(author.id);
  const authorName = normalizeValue(author.name);
  return (targetId && authorId && authorId === targetId) || (targetName && authorName && authorName === targetName);
};

export const updateAuthorInCaches = (target) => {
  if (!target) return;
  const updates = {
    id: target.id,
    name: target.name,
    avatar: target.avatar || '',
    cover: target.cover || '',
    school: target.school || '',
    className: target.className || '',
    email: target.email || '',
    isAdmin: target.isAdmin === true,
    tagInfo: target.tagInfo || target.tag || null,
  };

  const updateList = (posts) => {
    let changed = false;
    const nextPosts = posts.map((post) => {
      if (!post) return post;
      if (!matchesAuthor(post.author, updates)) return post;
      const normalized = normalizeAuthor(post.author);
      changed = true;
      return {
        ...post,
        author: {
          ...normalized,
          ...updates,
        },
      };
    });
    return { nextPosts, changed };
  };

  const localPosts = readLocalPosts();
  const localResult = updateList(localPosts);
  if (localResult.changed) {
    writeLocalPosts(localResult.nextPosts);
  }

  const cachedPosts = readRemotePostsCache();
  const cacheResult = updateList(cachedPosts);
  if (cacheResult.changed) {
    writeRemotePostsCache(cacheResult.nextPosts);
  }
};
