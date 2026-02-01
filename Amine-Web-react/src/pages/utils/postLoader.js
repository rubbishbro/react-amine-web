import { getCategoryColor } from '../config/colors.js';

/**
 * 加载帖子元数据（仅包含置顶和排序信息）
 */
export const loadPostMetadata = async () => {
  try {
    const response = await fetch('/posts/metadata.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.posts || [];
  } catch (error) {
    console.error('Error loading post metadata:', error);
    return [];
  }
};

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

  const name = (author.name || '').trim() || defaultAuthor.name;
  const id = author.id || encodeURIComponent(name) || defaultAuthor.id;

  return {
    ...defaultAuthor,
    ...author,
    id,
    name,
    avatar: author.avatar || '',
    school: author.school || '',
    className: author.className || '',
    email: author.email || '',
    isAdmin: author.isAdmin === true,
  };
};

const LOCAL_POSTS_KEY = 'aw_local_posts';
const LOCAL_DELETED_POSTS_KEY = 'aw_deleted_posts';

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

const getLocalPublishedPosts = () => {
  const posts = readLocalPosts();
  return posts.filter((item) => item.status === 'published');
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
      return {
        ...localPost,
        author: normalizeAuthor(localPost.author),
      };
    }
    // 使用fetch加载markdown文件
    const mdResponse = await fetch(`/posts/${postId}.md`);
    const mdContent = mdResponse.ok ? await mdResponse.text() : '';

    // 加载JSON元数据（完整的帖子信息）
    const jsonResponse = await fetch(`/posts/${postId}.json`);
    if (!jsonResponse.ok) {
      throw new Error(`Failed to load JSON for post ${postId}`);
    }
    const postData = await jsonResponse.json();

    return {
      ...postData,
      content: mdContent,
      id: postId,
      author: normalizeAuthor(postData.author),
    };
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
    // 获取所有帖子ID和元数据
    const metadataList = await loadPostMetadata();
    const postIds = metadataList.map(m => m.id);

    // 使用Promise.all并行加载所有帖子内容
    const postPromises = postIds.map(async (postId) => {
      const postData = await loadPostContent(postId);
      if (!postData) return null;

      // 查找对应的元数据（置顶信息）
      const postMetadata = metadataList.find(m => m.id === postId);

      return {
        ...postData,
        isPinnedGlobally: postMetadata?.pinnedIn?.length > 0 || false,
        pinnedInCategories: postMetadata?.pinnedIn || [],
        order: postMetadata?.order || 999 // 默认排序权重
      };
    });

    const loadedPosts = await Promise.all(postPromises);

    const localPosts = getLocalPublishedPosts();
    const merged = new Map();

    localPosts.forEach((post) => {
      merged.set(post.id, {
        ...post,
        author: normalizeAuthor(post.author),
        isPinnedGlobally: false,
        pinnedInCategories: [],
        order: post.order || 999,
      });
    });

    loadedPosts.forEach((post) => {
      if (post) {
        if (!merged.has(post.id)) {
          merged.set(post.id, post);
        }
      }
    });

    const combinedPosts = Array.from(merged.values());

    // 过滤掉加载失败的帖子
    const deletedIds = readDeletedPosts();
    const validPosts = combinedPosts.filter(post => post !== null && !deletedIds.includes(post.id));

    // 排序：先按置顶，再按order权重，最后按日期
    return validPosts.sort((a, b) => {
      // 1. 按是否在任何分类中置顶排序
      if (a.isPinnedGlobally && !b.isPinnedGlobally) return -1;
      if (!a.isPinnedGlobally && b.isPinnedGlobally) return 1;

      // 2. 按order权重排序（数字小的在前）
      if (a.order !== b.order) return a.order - b.order;

      // 3. 按日期倒序排序
      return new Date(b.date) - new Date(a.date);
    });
  } catch (error) {
    console.error('Error loading all posts:', error);
    return [];
  }
};

/**
 * 获取帖子在指定分类中的置顶状态
 * @param {object} postMetadata - 帖子元数据
 * @param {string} category - 当前分类
 * @returns {boolean} 是否在当前分类中置顶
 */
const isPinnedInCategory = (postMetadata, category) => {
  if (!postMetadata || !category || category === 'all' || category === '全部') {
    // 对于主页（全部帖子），检查是否有在任何分类中置顶
    return postMetadata?.pinnedIn?.length > 0;
  }

  // 检查是否在当前分类中置顶
  return postMetadata?.pinnedIn?.includes(category) || false;
};

/**
 * 按分类加载帖子
 */
export const loadPostsByCategory = async (category) => {
  try {
    // 先加载所有帖子
    const allPosts = await loadAllPosts();

    if (!category || category === 'all' || category === '全部') {
      return allPosts;
    }

    // 筛选指定分类的帖子
    let filteredPosts = allPosts.filter(post => {
      if (!post.category) return false;
      return post.category === category;
    });

    // 为每个帖子添加在当前分类中的置顶状态
    const postsWithPinnedStatus = filteredPosts.map(post => ({
      ...post,
      isPinnedInCurrentCategory: post.pinnedInCategories.includes(category)
    }));

    // 在当前分类内排序：先按当前分类置顶，再按order权重，最后按日期
    return postsWithPinnedStatus.sort((a, b) => {
      // 1. 按是否在当前分类中置顶排序
      if (a.isPinnedInCurrentCategory && !b.isPinnedInCurrentCategory) return -1;
      if (!a.isPinnedInCurrentCategory && b.isPinnedInCurrentCategory) return 1;

      // 2. 按order权重排序
      if (a.order !== b.order) return a.order - b.order;

      // 3. 按日期倒序排序
      return new Date(b.date) - new Date(a.date);
    });

  } catch (error) {
    console.error(`Error loading posts by category ${category}:`, error);
    return [];
  }
};

/**
 * 获取帖子在指定分类中的置顶状态
 * @param {string} postId - 帖子ID
 * @param {string} category - 分类名
 */
export const getPostPinnedStatus = async (postId, category) => {
  try {
    const metadataList = await loadPostMetadata();
    const postMetadata = metadataList.find(m => m.id === postId);
    return isPinnedInCategory(postMetadata, category);
  } catch (error) {
    console.error(`Error getting pinned status for post ${postId}:`, error);
    return false;
  }
};

/**
 * 获取帖子在所有分类中的置顶状态
 * @param {string} postId - 帖子ID
 */
export const getPostPinnedCategories = async (postId) => {
  try {
    const metadataList = await loadPostMetadata();
    const postMetadata = metadataList.find(m => m.id === postId);
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
 * 获取所有可用的分类（中文）
 */
export const getAllCategories = async () => {
  try {
    const allPosts = await loadAllPosts();
    const categories = new Set();

    allPosts.forEach(post => {
      if (post.category) {
        categories.add(post.category);
      }
    });

    return Array.from(categories).map(cat => ({
      id: cat,
      name: cat
    }));
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
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

    // 筛选多个分类的帖子
    const filteredPosts = allPosts.filter(post => {
      if (!post.category) return false;

      return categories.includes(post.category);
    });

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