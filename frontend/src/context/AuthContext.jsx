import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { useBackendReady } from '../hooks/useBackendReady.js';

const AuthContext = createContext(null);

const SESSION_BOOT_MAX_MS = 8000;

export function AuthProvider({ children }) {
  const { ready, waitForReady } = useBackendReady();
  const [user, setUser] = useState(() =>
    SKIP_AUTH ? { id: 0, full_name: 'Invité', username: 'guest', email: '' } : getStoredUser(),
  );
  const [loading, setLoading] = useState(!SKIP_AUTH);
  const [authView, setAuthView] = useState('login');
  const [authError, setAuthError] = useState(null);

  const isAuthenticated = SKIP_AUTH || !!user;

  // Refs pour éviter toute double restauration de session (identités stables)
  const waitRef = useRef(waitForReady);
  waitRef.current = waitForReady;
  const bootDoneRef = useRef(SKIP_AUTH);
  const validatedRef = useRef(SKIP_AUTH);
  const validatingRef = useRef(false);

  // Note : pas de garde de montage ici — l'effet a des deps [] et le drapeau
  // `cancelled` du cleanup stoppe proprement la 1re passe sous StrictMode (dev).
  useEffect(() => {
    if (SKIP_AUTH) return undefined;

    let cancelled = false;

    const finish = () => {
      if (!cancelled) setLoading(false);
    };

    const safetyTimer = setTimeout(finish, SESSION_BOOT_MAX_MS);

    (async () => {
      // Phase 1 : on attend le readiness backend (GET /health OK) avant de
      // valider la session. Le JWT, le stockage et /auth/me restent inchangés.
      const reachable = await waitRef.current();
      if (cancelled) return;

      if (!reachable) {
        // Backend injoignable même après retries : on CONSERVE la session locale
        // (pas de clearSession sur une erreur réseau — elle sera validée au
        // retour du serveur via l'effet de revalidation ci-dessous).
        bootDoneRef.current = true;
        clearTimeout(safetyTimer);
        finish();
        return;
      }

      try {
        const result = await apiRestoreSession();
        if (cancelled) return;
        validatedRef.current = true;
        setUser(result.user);
      } catch {
        if (!cancelled) {
          clearSession();
          setUser(null);
          validatedRef.current = true;
        }
      } finally {
        clearTimeout(safetyTimer);
        bootDoneRef.current = true;
        finish();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Revalidation : le backend est devenu READY après un démarrage à froid →
  // on valide alors la session locale (une seule fois, garde en cas de double
  // montage StrictMode en dev).
  useEffect(() => {
    if (
      SKIP_AUTH ||
      !ready ||
      validatedRef.current ||
      validatingRef.current ||
      !bootDoneRef.current
    ) {
      return undefined;
    }
    validatingRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const result = await apiRestoreSession();
        validatedRef.current = true;
        if (!cancelled) setUser(result.user);
      } catch {
        /* réseau indisponible — session locale conservée, on retentera au
           prochain passage de `ready` à true */
      } finally {
        validatingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

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
