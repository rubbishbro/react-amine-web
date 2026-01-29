/**
 * 颜色工具函数
 */

/**
 * 根据背景色计算合适的文字颜色
 * @param {string} backgroundColor - 背景色（十六进制）
 * @returns {string} 文字颜色
 */
export const getContrastTextColor = (backgroundColor) => {
  if (!backgroundColor) return '#212121';
  
  // 移除#号
  const hex = backgroundColor.replace('#', '');
  
  // 如果是3位简写，转为6位
  if (hex.length === 3) {
    return getContrastTextColor(
      '#' + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    );
  }
  
  // 转为RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // 计算相对亮度
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // 根据亮度选择文字颜色
  return luminance > 0.5 ? '#212121' : '#FFFFFF';
};

/**
 * 调整颜色亮度
 * @param {string} color - 原始颜色
 * @param {number} amount - 调整量（-1到1）
 * @returns {string} 调整后的颜色
 */
export const adjustColorBrightness = (color, amount) => {
  if (!color) return color;
  
  const hex = color.replace('#', '');
  
  if (hex.length === 3) {
    return adjustColorBrightness(
      '#' + hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2],
      amount
    );
  }
  
  let r = parseInt(hex.substr(0, 2), 16);
  let g = parseInt(hex.substr(2, 2), 16);
  let b = parseInt(hex.substr(4, 2), 16);
  
  // 调整亮度
  r = Math.max(0, Math.min(255, r + amount * 255));
  g = Math.max(0, Math.min(255, g + amount * 255));
  b = Math.max(0, Math.min(255, b + amount * 255));
  
  // 转回十六进制
  const toHex = (c) => {
    const hex = Math.round(c).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * 生成渐变色
 * @param {string} color - 基础颜色
 * @param {string} direction - 方向（如：135deg）
 * @returns {string} 渐变色
 */
export const generateGradient = (color, direction = '135deg') => {
  if (!color) return 'linear-gradient(135deg, #87CEEB, #6CB4EE)';
  
  const darker = adjustColorBrightness(color, -0.15);
  return `linear-gradient(${direction}, ${color}, ${darker})`;
};