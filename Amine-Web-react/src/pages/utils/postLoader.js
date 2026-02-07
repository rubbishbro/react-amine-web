import { getCategoryColor } from '../config/colors.js';
import { isUserBanned } from './adminMeta.js';
import { isBlocked } from './blockStore.js';
import { buildUserId, getCurrentViewerId } from './userId.js';

const LOCAL_POSTS_KEY = 'aw_local_posts';
const REMOTE_POSTS_CACHE_KEY = 'aw_posts_cache';
const LOCAL_DELETED_POSTS_KEY = 'aw_deleted_posts';
const LOCAL_PINNED_POSTS_KEY = 'aw_pinned_posts';

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

  return {
    ...defaultAuthor,
    ...author,
    id,
    name,
    avatar: author.avatar || author.avatarUrl || author.avatarURL || '',
    cover: author.cover || author.coverUrl || author.coverURL || '',
    school: author.school || author.college || '',
    className: author.className || author.class || author.grade || '',
    email: author.email || '',
    isAdmin: author.isAdmin === true,
  };
};

const readRemotePostsCache = () => {
  try {
    const raw = localStorage.getItem(REMOTE_POSTS_CACHE_KEY);
    if (!raw) return [];
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
  } catch (error) {
    console.error('Error writing remote posts cache:', error);
  }
};

// 保留后端接口，当前不主动调用
export const fetchPostsFromBackend = async () => {
  try {
    const response = await fetch('/api/posts');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const posts = Array.isArray(data?.posts) ? data.posts : [];
    writeRemotePostsCache(posts);
    return posts;
  } catch (error) {
    console.error('Error fetching posts from backend:', error);
    return [];
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

const isPostDeleted = (postId) => {
  const ids = readDeletedPosts();
  return ids.includes(postId);
};

export const markPostDeleted = (postId) => {
  const ids = readDeletedPosts();
  if (!ids.includes(postId)) {
    ids.push(postId);
    writeDeletedPosts(ids);
  }
  const posts = readLocalPosts();
  const nextPosts = posts.filter((item) => item.id !== postId);
  writeLocalPosts(nextPosts);
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

const getLocalPostById = (postId) => {
  const posts = readLocalPosts();
  return posts.find((item) => item.id === postId) || null;
};

const getCachedPostById = (postId) => {
  const posts = readRemotePostsCache();
  return posts.find((item) => item.id === postId) || null;
};

const getLocalPublishedPosts = () => {
  const posts = readLocalPosts();
  return posts.filter((item) => item.status === 'published');
};

const applyPinned = (post, pinnedIds) => ({
  ...post,
  author: normalizeAuthor(post.author),
  isPinnedGlobally: post.isPinnedGlobally === true || pinnedIds.includes(post.id),
  pinnedInCategories: post.pinnedInCategories || (pinnedIds.includes(post.id) ? ['全站'] : []),
  order: post.order || 999,
});

const buildMergedPosts = () => {
  const pinnedIds = readPinnedPosts();
  const merged = new Map();
  const localPosts = getLocalPublishedPosts();
  const cachedPosts = readRemotePostsCache();

  localPosts.forEach((post) => {
    merged.set(post.id, applyPinned(post, pinnedIds));
  });

  cachedPosts.forEach((post) => {
    if (!post || merged.has(post.id)) return;
    merged.set(post.id, applyPinned(post, pinnedIds));
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
    if (isPostDeleted(postId)) {
      return null;
    }
    const localPost = getLocalPostById(postId);
    if (localPost) {
      return applyPinned(localPost, readPinnedPosts());
    }
    const cachedPost = getCachedPostById(postId);
    if (!cachedPost) return null;
    return applyPinned({ ...cachedPost, id: postId }, readPinnedPosts());
  } catch (error) {
    console.error(`Error loading post ${postId}:`, error);
    return null;
  }
};

/**
 * 加载所有帖子的完整数据
 */
export const loadAllPosts = async () => {
  try {
    const viewerId = getCurrentViewerId();
    const deletedIds = readDeletedPosts();
    const validPosts = buildMergedPosts()
      .filter((post) => {
        if (post === null) return false;
        if (deletedIds.includes(post.id)) return false;
        // 过滤被封禁/拉黑用户的帖子
        const normalizedAuthor = normalizeAuthor(post.author);
        const authorId = normalizedAuthor?.id || buildUserId(normalizedAuthor?.name || '', '');
        if (viewerId && authorId) {
          if (isBlocked(authorId, viewerId)) return false;
          if (isBlocked(viewerId, authorId)) return false;
        }
        if (authorId && isUserBanned(authorId)) return false;
        return true;
      });

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