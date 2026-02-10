/**
 * API 基础地址配置
 */

const normalizeBaseUrl = (value) => {
  if (!value) return '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || '/api/v1'
);

export const buildApiUrl = (path) => {
  const safePath = path?.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${safePath}`;
};
