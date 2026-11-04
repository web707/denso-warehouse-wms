import { ApiError } from './errors';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_KEY = 'wms_auto_token';

let loginPromise = null;

async function getOrFetchToken() {
  try {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) return saved;
  } catch (e) {
    // localStorage may be disabled in some environments
  }

  if (!loginPromise) {
    loginPromise = (async () => {
      try {
        let res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@denso-wms.local', password: 'Admin@123456' }),
        });
        if (!res.ok) {
          res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@logibackend.local', password: 'Admin@123456' }),
          });
        }
        if (res.ok) {
          const data = await res.json();
          const token = data?.accessToken || null;
          if (token) {
            try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
          }
          return token;
        }
      } catch (err) {
        console.warn('Auto-auth failed:', err);
      }
      return null;
    })().finally(() => {
      loginPromise = null;
    });
  }
  return loginPromise;
}

async function requestRaw(path, opts = {}, isRetry = false) {
  const { method = 'GET', body, headers = {} } = opts;
  const isAuthLogin = path.includes('/auth/login');

  let authHeader = {};
  if (!isAuthLogin) {
    const token = await getOrFetchToken();
    if (token) {
      authHeader = { Authorization: `Bearer ${token}` };
    }
  }

  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader,
      ...headers,
    },
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !isRetry && !isAuthLogin) {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    const refreshedToken = await getOrFetchToken();
    if (refreshedToken) {
      return requestRaw(path, opts, true);
    }
  }

  return res;
}

export async function request(path, opts = {}) {
  const res = await requestRaw(path, opts);
  if (!res.ok) throw await ApiError.fromResponse(res);
  if (res.status === 204) return null;
  return res.json();
}

// For endpoints that return a raw Response (e.g. file downloads).
export async function raw(path, opts = {}) {
  const res = await requestRaw(path, opts);
  if (!res.ok) throw await ApiError.fromResponse(res);
  return res;
}
