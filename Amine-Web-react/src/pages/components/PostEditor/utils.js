// pages/components/PostEditor/utils.js

/**
 * 生成帖子ID
 * @returns {string} 格式：post-{timestamp}
 */
export const generatePostId = () => {
  const timestamp = Date.now();
  return `post-${timestamp}`;
};

/**
 * 计算阅读时间
 * @param {string} content - Markdown内容
 * @returns {string} 阅读时间，如 "5 min read"
 */
export const calculateReadTime = (content) => {
  if (!content) return '0 min read';
  
  // 移除Markdown标记
  const plainText = content
    .replace(/[#*`[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const words = plainText.length > 0 ? plainText.split(' ').length : 0;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
};

/**
 * 自动生成摘要
 * @param {string} content - Markdown内容
 * @param {number} maxLength - 最大长度
 * @returns {string} 生成的摘要
 */
export const generateSummary = (content, maxLength = 200) => {
  if (!content) return '';
  
  // 移除Markdown标记
  const plainText = content
    .replace(/[#*`[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  return plainText.substring(0, maxLength) + '...';
};

/**
 * 格式化日期
 * @param {string|Date} date - 日期
 * @returns {string} 格式化的日期，如 "2024-01-28"
 */
export const formatDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * 检查是否有未保存的更改
 * @param {object} originalData - 原始数据
 * @param {object} currentData - 当前数据
 * @returns {boolean}
 */
export const hasUnsavedChanges = (originalData, currentData) => {
  const keys = ['title', 'category', 'content', 'summary'];
  
  for (const key of keys) {
    if (originalData[key] !== currentData[key]) {
      return true;
    }
  }
  
  // 检查标签
  if (JSON.stringify(originalData.tags) !== JSON.stringify(currentData.tags)) {
    return true;
  }
  
  return false;
};

/**
 * 验证帖子数据
 * @param {object} postData - 帖子数据
 * @returns {object} 验证结果 { isValid: boolean, errors: object }
 */
export const validatePostData = (postData) => {
  const errors = {};
  
  if (!postData.title?.trim()) {
    errors.title = '标题不能为空';
  } else if (postData.title.length < 2) {
    errors.title = '标题至少2个字';
  } else if (postData.title.length > 100) {
    errors.title = '标题最多100个字';
  }
  
  if (!postData.category) {
    errors.category = '请选择分类';
  }
  
  if (!postData.content?.trim()) {
    errors.content = '内容不能为空';
  }
  
  if (postData.summary && postData.summary.length > 300) {
    errors.summary = '摘要最多300个字';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};