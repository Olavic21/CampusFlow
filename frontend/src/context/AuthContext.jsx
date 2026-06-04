import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  restoreSession as apiRestoreSession,
  persistSession,
  clearSession,
  getStoredUser,
  SKIP_AUTH,
} from '../services/authApi';

const AuthContext = createContext(null);

const SESSION_BOOT_MAX_MS = 8000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    SKIP_AUTH ? { id: 0, full_name: 'Invité', username: 'guest', email: '' } : getStoredUser(),
  );
  const [loading, setLoading] = useState(!SKIP_AUTH);
  const [authView, setAuthView] = useState('login');
  const [authError, setAuthError] = useState(null);

  const isAuthenticated = SKIP_AUTH || !!user;

  useEffect(() => {
    if (SKIP_AUTH) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    const finish = () => {
      if (!cancelled) setLoading(false);
    };

    const safetyTimer = setTimeout(finish, SESSION_BOOT_MAX_MS);

    (async () => {
      try {
        const result = await apiRestoreSession();
        if (cancelled) return;
        setUser(result.user);
      } catch {
        if (!cancelled) {
          clearSession();
          setUser(null);
        }
      } finally {
        clearTimeout(safetyTimer);
        finish();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  const login = useCallback(async (loginVal, password) => {
    setAuthError(null);
    const data = await apiLogin(loginVal, password);
    persistSession(data);
    setUser(data.user);
    setLoading(false);
    try {
      sessionStorage.setItem('cf_just_logged_in', '1');
    } catch {
      /* ignore */
    }
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    setAuthError(null);
    const data = await apiRegister(payload);
    persistSession(data);
    setUser(data.user);
    setLoading(false);
    try {
      sessionStorage.setItem('cf_just_registered', '1');
    } catch {
      /* ignore */
    }
    return data;
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated,
      authView,
      setAuthView,
      authError,
      setAuthError,
      login,
      register,
      logout,
      setUser,
    }),
    [user, loading, isAuthenticated, authView, authError, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
