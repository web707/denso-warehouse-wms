import { environmentKey, isDemoMode } from '@/lib/environment';
import { ApiError } from './errors';

const API_BASE = isDemoMode
  ? '/api'
  : (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
      ? '/api'
      : (import.meta.env.VITE_API_BASE_URL || '/api'));
const TOKEN_KEY = environmentKey('masan_access_token');
const REFRESH_KEY = environmentKey('masan_refresh_token');
let refreshPending = null;

export function getAccessToken() { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } }
export function setAuthSession(tokens) {
  sessionStorage.setItem(TOKEN_KEY, tokens.accessToken);
  sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}
export function clearAuthSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

async function refreshAccessToken() {
  if (!refreshPending) {
    refreshPending = (async () => {
      const token = sessionStorage.getItem(REFRESH_KEY);
      if (!token) return false;
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if ([400, 401, 403].includes(response.status)) return false;
      if (!response.ok) throw await ApiError.fromResponse(response);
      setAuthSession(await response.json());
      return true;
    })().finally(() => { refreshPending = null; });
  }
  return refreshPending;
}

async function requestRaw(path, opts = {}) {
  const { method = 'GET', body, headers = {} } = opts;
  const send = () => fetch(API_BASE + path, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  });
  let response;
  try {
    response = await send();
  } catch (err) {
    if (method === 'GET') {
      await new Promise((r) => setTimeout(r, 1200));
      response = await send();
    } else {
      throw err;
    }
  }
  if (method === 'GET' && [502, 503, 504].includes(response.status)) {
    await new Promise((r) => setTimeout(r, 1500));
    response = await send();
  }
  if (response.status === 401 && (path === '/auth/me' || !path.startsWith('/auth/'))) {
    if (await refreshAccessToken()) response = await send();
    if (response.status === 401) {
      clearAuthSession();
      window.dispatchEvent(new Event('masan-session-expired'));
    }
  }
  return response;
}
export async function request(path, opts = {}) {
  const res = await requestRaw(path, opts);
  if (!res.ok) throw await ApiError.fromResponse(res);
  if (res.status === 204) return null;
  return res.json();
}
export async function raw(path, opts = {}) {
  const res = await requestRaw(path, opts);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res;
}
