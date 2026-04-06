/**
 * API 基础地址配置
 */

const normalizeBaseUrl = (value) => {
  if (!value) return '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const getDefaultApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return '/api/v1';
  }

  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';

  if (isLocalhost) {
    return '/api/v1';
  }

  // Production should always use the dedicated API subdomain.
  return 'https://api.lnssy-cykj.online/api/v1';
};

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl()
);

export const buildApiUrl = (path) => {
  const safePath = path?.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${safePath}`;
};
