/**
 * 网站颜色配置
 */

// 分类颜色配置
export const categoryColors = {
  // 主要分类
  '季度新番': '#FF99C8',
  '社团活动': '#A9DEF9',
  '前沿技术': '#E4C1F9',
  '论坛闲聊': '#dbcb36',
  '同人/杂谈': '#FF85A1',
  '网络资源': '#4CC9F0',
  '音游区': '#6dd394',
  '网站开发': '#FFD6A5',

  // 默认颜色（当分类未定义时使用）
  'default': '#9a9d9e'
};

/**
 * 获取分类对应的颜色
 * @param {string} category - 分类名称
 * @returns {string} 颜色值
 */
export const getCategoryColor = (category) => {
  if (!category) return categoryColors.default;
  return categoryColors[category] || categoryColors.default;
};

/**
 * 获取分类文本颜色（复用分类颜色）
 * @param {string} category - 分类名称
 * @returns {string} 颜色值
 */
export const getCategoryTextColor = (category) => {
  return getCategoryColor(category);
};

export default {
  categoryColors,
  getCategoryColor,
  getCategoryTextColor
};