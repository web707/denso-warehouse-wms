import { ApiError } from './errors';

// Local dev leaves this unset and rides the Vite proxy (see vite.config.js)
// so calls stay same-origin. Production sets VITE_API_BASE_URL to the
// separately-hosted backend, since the frontend and API live on different
// domains there (see CORS_ORIGIN in the backend .env).
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function requestRaw(path, opts = {}) {
  const { method = 'GET', body, headers = {} } = opts;
  return fetch(API_BASE + path, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body instanceof FormData ? body : body != null ? JSON.stringify(body) : undefined,
  });
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
