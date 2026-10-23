export const AUTH_STORAGE_KEY = 'userDetails';

export function getStoredAuth() {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    if (!data?.access_token || !data?.expireDate) return null;
    return data;
  } catch {
    return null;
  }
}

export function isAuthValid(auth) {
  if (!auth?.access_token || !auth?.expireDate) return false;
  return new Date(auth.expireDate).getTime() > Date.now();
}

export function saveAuth(auth) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function normalizeAuthResponse(data) {
  const token = data?.token || '';
  const user = data?.user || {};
  const expiresInSeconds = getTokenExpiryInSeconds(token);

  return {
    email: user?.emailAddress || '',
    access_token: token,
    user_id: user?.uuid || '',
    expiresIn: expiresInSeconds,
    user,
    expireDate: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
}

function getTokenExpiryInSeconds(token) {
  const fallback = 24 * 60 * 60;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    if (!payload?.exp || payload.exp <= now) return fallback;
    return payload.exp - now;
  } catch {
    return fallback;
  }
}
