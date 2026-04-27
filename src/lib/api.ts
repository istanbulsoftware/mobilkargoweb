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

let authRedirectInProgress = false;

const isAuthExpiredError = (error: any) => {
  const status = Number(error?.response?.status || 0);
  const rawMessage = String(error?.response?.data?.message || error?.message || '')
    .trim()
    .toLowerCase();

  if (status === 401) return true;
  if (!rawMessage) return false;

  return (
    rawMessage.includes('invalid token') ||
    rawMessage.includes('jwt expired') ||
    rawMessage.includes('unauthorized') ||
    rawMessage.includes('not authorized') ||
    rawMessage.includes('token expired')
  );
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('an_user_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isAuthExpiredError(error)) {
      try {
        localStorage.removeItem('an_user_token');
      } catch {
        // no-op
      }

      if (error?.response?.data) {
        error.response.data.message = 'Oturum suresi doldu. Lutfen tekrar giris yapin.';
      }

      if (!authRedirectInProgress) {
        authRedirectInProgress = true;
        const loginPath = '/login';
        if (!window.location.pathname.startsWith(loginPath)) {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.assign(`${loginPath}?oturum=bitti&next=${next}`);
        }
      }
    }

    return Promise.reject(error);
  },
);
