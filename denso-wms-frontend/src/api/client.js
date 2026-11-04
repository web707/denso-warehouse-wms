import { ApiError } from './errors';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_KEY = 'masan_access_token';
const REFRESH_KEY = 'masan_refresh_token';
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
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token }),
        });
        if (!response.ok) return false;
        setAuthSession(await response.json());
        return true;
      } catch { return false; }
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
  let response = await send();
  if (response.status === 401 && !path.startsWith('/auth/')) {
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
