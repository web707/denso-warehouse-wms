import { ApiError } from './errors';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
// This source version is configured for public warehouse access. Do not embed
// administrator credentials in the browser bundle. Authenticated deployments can
// opt into bearer tokens via the existing localStorage key.
const TOKEN_KEY = 'wms_auto_token';
function getConfiguredToken() {
  if (import.meta.env.VITE_USE_BEARER_AUTH !== 'true') return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

async function requestRaw(path, opts = {}) {
  const { method = 'GET', body, headers = {} } = opts;
  const token = getConfiguredToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader,
      ...headers,
    },
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  });

  // A 401 is a real deployment/auth mismatch, not a reason to retry
  // using hard-coded admin passwords from JavaScript.
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
