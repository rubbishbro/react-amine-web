/**
 * 网站颜色配置
 */

// 分类颜色配置
export const categoryColors = {
  // 主要分类
  '季度新番': '#FF99C8',
  '社团活动': '#A9DEF9',
  '前沿技术': '#E4C1F9',
  '论坛闲聊': '#FCF6BD',
  '同人/杂谈': '#FF85A1',
  '网络资源': '#4CC9F0',
  '音游区': '#D0F4DE',
  '网站开发': '#FFD6A5', // 你的指定颜色
  
  // 默认颜色（当分类未定义时使用）
  'default': '#656869'
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
 * 主题颜色配置
 */
export const themeColors = {
  // 主色调
  primary: '#FFD6A5',        // 主色（网站开发分类色）
  primaryLight: '#FFE6C7',   // 主色浅色
  primaryDark: '#FFC685',    // 主色深色
  
  // 辅助色
  secondary: '#87CEEB',      // 辅助色
  success: '#4CAF50',        // 成功色
  warning: '#FF9800',        // 警告色
  error: '#F44336',          // 错误色
  info: '#2196F3',           // 信息色
  
  // 中性色
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  gray: '#9E9E9E',
  darkGray: '#616161',
  black: '#212121',
  
  // 背景色
  background: '#F8F9FA',
  cardBackground: '#FFFFFF',
  
  // 文字色
  textPrimary: '#212121',
  textSecondary: '#616161',
  textDisabled: '#9E9E9E',
  textInverse: '#FFFFFF',
  
  // 边框色
  borderLight: '#E0E0E0',
  borderMedium: '#BDBDBD',
  borderDark: '#757575'
};

/**
 * 按钮颜色配置
 */
export const buttonColors = {
  primary: {
    background: '#FFD6A5',
    text: '#212121',
    hover: '#FFC685',
    active: '#FFB966'
  },
  secondary: {
    background: '#87CEEB',
    text: '#FFFFFF',
    hover: '#6CB4EE',
    active: '#5DADEC'
  },
  success: {
    background: '#4CAF50',
    text: '#FFFFFF',
    hover: '#45A049',
    active: '#3D8B40'
  }
};

/**
 * 置顶相关颜色
 */
export const pinnedColors = {
  badgeBackground: 'linear-gradient(135deg, #FFD700, #FFA500)',
  badgeText: '#FFFFFF',
  badgeShadow: 'rgba(255, 215, 0, 0.3)',
  border: '#FFD700',
  borderShadow: 'rgba(255, 215, 0, 0.2)'
};

/**
 * 获取渐变色
 */
export const gradients = {
  primary: 'linear-gradient(135deg, #FFD6A5, #FFB966)',
  secondary: 'linear-gradient(135deg, #87CEEB, #6CB4EE)',
  success: 'linear-gradient(135deg, #4CAF50, #45A049)',
  pinned: 'linear-gradient(135deg, #FFD700, #FFA500)'
};

/**
 * 导出所有颜色配置
 */
export default {
  categoryColors,
  themeColors,
  buttonColors,
  pinnedColors,
  gradients,
  getCategoryColor
};