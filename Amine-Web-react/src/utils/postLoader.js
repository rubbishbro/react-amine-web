/**
 * 加载所有帖子的元数据
 */
export const loadAllPostMetadata = async () => {
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

/**
 * 加载单个帖子的详细内容
 * @param {string} postId - 帖子ID
 */
export const loadPostContent = async (postId) => {
  try {
    // 使用fetch加载markdown文件
    const mdResponse = await fetch(`/posts/${postId}.md`);
    const mdContent = mdResponse.ok ? await mdResponse.text() : '';
    
    // 加载JSON元数据
    const jsonResponse = await fetch(`/posts/${postId}.json`);
    if (!jsonResponse.ok) {
      throw new Error(`Failed to load JSON for post ${postId}`);
    }
    const metadata = await jsonResponse.json();
    
    return {
      ...metadata,
      content: mdContent,
      id: postId
    };
  } catch (error) {
    console.error(`Error loading post ${postId}:`, error);
    return null;
  }
};

/**
 * 加载所有帖子的完整数据（用于主页）
 */
export const loadAllPosts = async () => {
  try {
    const metadataList = await loadAllPostMetadata();
    
    // 使用Promise.all并行加载所有帖子
    const postPromises = metadataList.map(async (metadata) => {
      const postData = await loadPostContent(metadata.id);
      return postData;
    });
    
    const loadedPosts = await Promise.all(postPromises);
    
    // 过滤掉加载失败的帖子
    const validPosts = loadedPosts.filter(post => post !== null);
    
    // 排序：先按置顶排序（置顶在前），再按日期倒序
    return validPosts.sort((a, b) => {
      // 获取置顶状态
      const aIsPinned = metadataList.find(m => m.id === a.id)?.pinned || false;
      const bIsPinned = metadataList.find(m => m.id === b.id)?.pinned || false;
      
      // 如果a置顶而b不置顶，a在前
      if (aIsPinned && !bIsPinned) return -1;
      // 如果b置顶而a不置顶，b在前
      if (!aIsPinned && bIsPinned) return 1;
      // 如果都置顶或都不置顶，按日期倒序
      return new Date(b.date) - new Date(a.date);
    });
  } catch (error) {
    console.error('Error loading all posts:', error);
    return [];
  }
};

/**
 * 按中文分类加载帖子
 * @param {string} category - 中文分类名
 */
export const loadPostsByCategory = async (category) => {
  try {
    const allPosts = await loadAllPosts();
    
    if (!category || category === 'all' || category === '全部') {
      return allPosts;
    }
    
    // 直接按中文分类名筛选
    const filteredPosts = allPosts.filter(post => {
      if (!post.category) return false;
      
      // 直接比较中文分类名
      return post.category === category;
    });
    
    return filteredPosts;
  } catch (error) {
    console.error(`Error loading posts by category ${category}:`, error);
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
export const getCategoryColor = (category) => {
  const colors = {
      '季度新番': '#FF99C8',
      '社团活动': '#A9DEF9',
      '前沿技术': '#E4C1F9',
      '论坛闲聊': '#FCF6BD',
      '同人/杂谈': '#FF85A1',
      '网络资源': '#4CC9F0',
      '音游区': '#D0F4DE',
      '网站开发': '#FFD6A5'
  };
  return colors[category] || '#87CEEB'; // 默认淡蓝色
};

/**
 * 获取帖子的置顶状态
 * @param {string} postId - 帖子ID
 */
export const getPostPinnedStatus = async (postId) => {
  try {
    const metadataList = await loadAllPostMetadata();
    const postMetadata = metadataList.find(m => m.id === postId);
    return postMetadata?.pinned || false;
  } catch (error) {
    console.error(`Error getting pinned status for post ${postId}:`, error);
    return false;
  }
};