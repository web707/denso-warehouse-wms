import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/api';
import { clearAuthSession, getAccessToken, setAuthSession } from '@/api/client';

const USER_KEY = 'masan_user';

function getStoredUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [signedIn, setSignedIn] = useState(Boolean(getAccessToken()));
  const [user, setUser] = useState(() => getStoredUser());
  const [checking, setChecking] = useState(!getStoredUser() && Boolean(getAccessToken()));

  const logout = useCallback(() => {
    clearAuthSession();
    try { sessionStorage.removeItem(USER_KEY); } catch {}
    setSignedIn(false);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!getAccessToken()) return;
    let alive = true;
    api.auth.me()
      .then((u) => {
        if (alive) {
          setUser(u);
          try { sessionStorage.setItem(USER_KEY, JSON.stringify(u)); } catch {}
        }
      })
      .catch(() => {
        if (alive) logout();
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => { alive = false; };
  }, [logout]);

  useEffect(() => {
    window.addEventListener('masan-session-expired', logout);
    return () => window.removeEventListener('masan-session-expired', logout);
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const result = await api.auth.login(username, password);
    setAuthSession(result);
    if (result.user) {
      setUser(result.user);
      try { sessionStorage.setItem(USER_KEY, JSON.stringify(result.user)); } catch {}
    }
    setSignedIn(true);
    setChecking(false);
    return result.user;
  }, []);

  return <AuthContext.Provider value={{ signedIn, checking, user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
