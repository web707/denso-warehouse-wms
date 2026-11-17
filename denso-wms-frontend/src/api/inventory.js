import { request } from './client';
import { environmentKey } from '@/lib/environment';

const pendingKeys = new Map();
const inFlight = new Map();

export function createInventoryTransaction(body, actorId) {
  const payload = JSON.stringify(body, Object.keys(body).sort());
  const storageKey = environmentKey(`wms:inventory:${actorId}:${payload}`);
  if (inFlight.has(storageKey)) return inFlight.get(storageKey);

  let key = pendingKeys.get(storageKey);
  try { key ||= sessionStorage.getItem(storageKey); } catch { /* use the in-memory key */ }
  const retry = Boolean(key);
  if (!key) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    pendingKeys.set(storageKey, key);
    try { sessionStorage.setItem(storageKey, key); } catch { /* use the in-memory key */ }
  }

  const clear = () => {
    pendingKeys.delete(storageKey);
    try { sessionStorage.removeItem(storageKey); } catch { /* storage unavailable */ }
  };
  const submission = request('/inventory/transactions', {
    method: 'POST', body, headers: { 'Idempotency-Key': key },
  }).then(result => {
    clear();
    return { ...result, retry };
  }).catch(error => {
    // A transport/server failure can happen after commit. Keep the key until the result is known.
    if (error.status >= 400 && error.status < 500 && ![401, 408, 429].includes(error.status)) clear();
    throw error;
  }).finally(() => inFlight.delete(storageKey));
  inFlight.set(storageKey, submission);
  return submission;
}
