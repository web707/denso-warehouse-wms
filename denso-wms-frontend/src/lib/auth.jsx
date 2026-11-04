import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/api';
import { clearAuthSession, getAccessToken, setAuthSession } from '@/api/client';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [signedIn, setSignedIn] = useState(Boolean(getAccessToken()));
  const [checking, setChecking] = useState(Boolean(getAccessToken()));
  const [user, setUser] = useState(null);
  const logout = useCallback(() => {
    clearAuthSession(); setSignedIn(false); setUser(null);
  }, []);
  useEffect(() => {
    if (!getAccessToken()) return;
    let alive = true;
    api.auth.me().then((u) => { if (alive) setUser(u); })
      .catch(() => { if (alive) logout(); }).finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [logout]);
  useEffect(() => {
    window.addEventListener('masan-session-expired', logout);
    return () => window.removeEventListener('masan-session-expired', logout);
  }, [logout]);
  const login = useCallback(async (username, password) => {
    const result = await api.auth.login(username, password);
    setAuthSession(result);
    setUser(result.user);
    setSignedIn(true);
    return result.user;
  }, []);
  return <AuthContext.Provider value={{ signedIn, checking, user, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
