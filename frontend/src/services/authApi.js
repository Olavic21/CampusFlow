import { parseApiError } from '../utils/parseApiError';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const DIRECT_BACKEND = (import.meta.env.VITE_BACKEND_DIRECT || 'http://127.0.0.1:8000').replace(
  /\/$/,
  '',
);
const AUTH_TIMEOUT_MS = 15000;
const REGISTER_TIMEOUT_MS = 20000;
const HEALTH_TIMEOUT_MS = 3000;
const SESSION_RESTORE_TIMEOUT_MS = 4000;
const STORAGE_ACCESS = 'campusflow_access_token';
const STORAGE_REFRESH = 'campusflow_refresh_token';
const STORAGE_USER = 'campusflow_user';

export function getStoredTokens() {
  return {
    access: localStorage.getItem(STORAGE_ACCESS),
    refresh: localStorage.getItem(STORAGE_REFRESH),
  };
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persistSession({ access_token, refresh_token, user }) {
  if (!access_token || !refresh_token || !user) {
    throw new Error('Réponse serveur incomplète — tokens manquants');
  }
  localStorage.setItem(STORAGE_ACCESS, access_token);
  localStorage.setItem(STORAGE_REFRESH, refresh_token);
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_ACCESS);
  localStorage.removeItem(STORAGE_REFRESH);
  localStorage.removeItem(STORAGE_USER);
}

/** URLs à tester : proxy Vite puis backend direct (CORS activé) */
function getApiBases() {
  const bases = [API_BASE];
  if (!bases.includes(DIRECT_BACKEND)) {
    bases.push(DIRECT_BACKEND);
  }
  return bases;
}

function buildUrl(base, path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (base === '/api' || base.endsWith('/api')) {
    return `${base}${p}`;
  }
  return `${base}${p}`;
}

/**
 * Vérifie que l'API répond avant inscription/connexion.
 */
export async function checkAuthBackend() {
  const errors = [];
  for (const base of getApiBases()) {
    const url = buildUrl(base, '/health');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      clearTimeout(timer);
      if (res.ok) return { ok: true, base };
      errors.push(`${url} → HTTP ${res.status}`);
    } catch (e) {
      clearTimeout(timer);
      errors.push(`${url} → ${e?.name === 'AbortError' ? 'timeout' : e.message}`);
    }
  }
  return {
    ok: false,
    message:
      "L'API CampusFlow ne répond pas. Ouvrez un terminal, exécutez : .\\scripts\\restart-backend.ps1 (ou : cd backend ; uvicorn app.main:app --reload --port 8000)",
    details: errors,
  };
}

async function authRequest(path, options = {}) {
  const timeoutMs = options.timeoutMs ?? AUTH_TIMEOUT_MS;
  const bases = options.bases ?? getApiBases();
  const { access } = getStoredTokens();
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (access && !options.skipAuth) {
    headers.Authorization = `Bearer ${access}`;
  }

  let lastError = null;

  for (const base of bases) {
    const url = buildUrl(base, path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: options.method || 'GET',
        body: options.body,
        headers,
        signal: controller.signal,
      });

      let data = null;
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        const msg = parseApiError(data, res.status);
        const err = new Error(msg);
        err.status = res.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (err) {
      if (err?.status && err.status < 500) {
        throw err;
      }
      if (err?.name === 'AbortError') {
        lastError = new Error(
          "Délai dépassé — l'API ne répond pas. Redémarrez le backend : .\\scripts\\restart-backend.ps1",
        );
      } else if (err instanceof TypeError) {
        lastError = new Error(
          'Serveur injoignable — lancez le backend sur le port 8000 (voir scripts/restart-backend.ps1)',
        );
      } else {
        lastError = err;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error('Impossible de joindre le serveur');
}

async function authRequestWithRefresh(path, options = {}) {
  try {
    return await authRequest(path, options);
  } catch (err) {
    if (err.status !== 401 || options.skipAuth || options._retried) throw err;
    await refreshSession();
    return authRequest(path, { ...options, _retried: true });
  }
}

export async function register(payload) {
  const health = await checkAuthBackend();
  if (!health.ok) {
    throw new Error(health.message);
  }

  const data = await authRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      full_name: payload.full_name,
      email: payload.email.toLowerCase(),
      username: payload.username.toLowerCase(),
      password: payload.password,
      password_confirm: payload.password_confirm,
    }),
    skipAuth: true,
    timeoutMs: REGISTER_TIMEOUT_MS,
    bases: health.base ? [health.base, ...getApiBases().filter((b) => b !== health.base)] : undefined,
  });

  if (!data?.access_token || !data?.refresh_token || !data?.user) {
    throw new Error('Réponse serveur incomplète après inscription');
  }
  return data;
}

export async function login(login, password) {
  const health = await checkAuthBackend();
  if (!health.ok) {
    throw new Error(health.message);
  }

  const data = await authRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login: login.trim().toLowerCase(), password }),
    skipAuth: true,
    bases: health.base ? [health.base, ...getApiBases().filter((b) => b !== health.base)] : undefined,
  });
  if (!data?.access_token || !data?.user) {
    throw new Error('Réponse serveur incomplète');
  }
  return data;
}

export async function logout() {
  try {
    await authRequestWithRefresh('/auth/logout', { method: 'POST' });
  } catch {
    /* déconnexion locale même si token expiré */
  } finally {
    clearSession();
  }
}

export async function fetchMe(options = {}) {
  return authRequestWithRefresh('/auth/me', {
    timeoutMs: SESSION_RESTORE_TIMEOUT_MS,
    bases: [API_BASE],
    ...options,
  });
}

export async function refreshSession() {
  const { refresh } = getStoredTokens();
  if (!refresh) throw new Error('Pas de session');
  const data = await authRequest('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refresh }),
    skipAuth: true,
    timeoutMs: SESSION_RESTORE_TIMEOUT_MS,
    bases: [API_BASE],
  });
  persistSession(data);
  return data;
}

/**
 * Restaure la session au démarrage — rapide, une seule URL, timeout court.
 * Retourne { user } ou { user: null }.
 */
export async function restoreSession() {
  const { access, refresh } = getStoredTokens();
  if (!access && !refresh) {
    return { user: null };
  }

  const cached = getStoredUser();
  const opts = { timeoutMs: SESSION_RESTORE_TIMEOUT_MS, bases: [API_BASE] };

  try {
    if (access) {
      const me = await authRequestWithRefresh('/auth/me', opts);
      const tokens = getStoredTokens();
      persistSession({
        access_token: tokens.access,
        refresh_token: tokens.refresh,
        user: me,
      });
      return { user: me };
    }
  } catch {
    /* token expiré ou API down */
  }

  if (refresh) {
    try {
      const data = await refreshSession();
      return { user: data.user };
    } catch {
      clearSession();
      return { user: null };
    }
  }

  clearSession();
  return { user: null };
}

export async function getPreferences() {
  return authRequestWithRefresh('/auth/me/preferences');
}

export async function updatePreferences(prefs) {
  return authRequestWithRefresh('/auth/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  });
}

export async function getFavoriteLocations() {
  return authRequestWithRefresh('/users/favorites/locations');
}

export async function addFavoriteLocation(locationId, label) {
  return authRequestWithRefresh('/users/favorites/locations', {
    method: 'POST',
    body: JSON.stringify({ location_id: locationId, label }),
  });
}

export async function removeFavoriteLocation(id) {
  return authRequestWithRefresh(`/users/favorites/locations/${id}`, { method: 'DELETE' });
}

export async function getRouteHistory() {
  return authRequestWithRefresh('/users/routes/history');
}

export async function saveRouteHistory(entry) {
  return authRequestWithRefresh('/users/routes/history', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function getFavoriteRoutes() {
  return authRequestWithRefresh('/users/favorites/routes');
}

export async function addFavoriteRoute(payload) {
  return authRequestWithRefresh('/users/favorites/routes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function removeFavoriteRoute(id) {
  return authRequestWithRefresh(`/users/favorites/routes/${id}`, { method: 'DELETE' });
}

export const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === 'true';
