import axios from 'axios';

const rawBaseURL =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api'
    : `${window.location.origin}/api`);

const baseURL = rawBaseURL.replace(/\/$/, '');

export const apiOrigin = (() => {
  try {
    return new URL(baseURL).origin;
  } catch {
    return window.location.origin;
  }
})();

export const toAbsoluteAssetUrl = (value?: string) => {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) {
    if (window.location.protocol === 'https:' && value.startsWith('http://')) {
      return value.replace(/^http:\/\//i, 'https://');
    }
    return value;
  }
  if (value.startsWith('//')) return `${window.location.protocol}${value}`;
  if (value.startsWith('/')) return `${apiOrigin}${value}`;
  return value;
};

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('an_user_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

