/**
 * Phase 1 — Readiness du backend (cold start Render).
 *
 * Rôle : déterminer, AVANT tout appel métier, si le backend FastAPI est joignable.
 *  - 1 tentative immédiate puis exponential backoff plafonné + jitter
 *  - timeout par tentative (le fetch est annulé, mais la requête a déjà réveillé Render)
 *  - distinction sémantique : erreurs réseau/5xx = cold start (retry) ;
 *    401/403/404/422 = le serveur répond → PAS un cold start (pas de retry)
 *
 * Aucun setInterval : les retries s'arrêtent après MAX_HEALTH_ATTEMPTS (ou à la
 * première erreur fatale). Le réveil ultérieur est déclenché par une action
 * utilisateur (retry manuel) ou un événement `online` du navigateur.
 */
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/** Timeout d'une tentative /health. Assez long pour laisser Render se réveiller. */
export const HEALTH_TIMEOUT_MS = 10000;

/** Nombre maximal de tentatives au démarrage (dont la 1re immédiate). */
export const MAX_HEALTH_ATTEMPTS = 8;

/**
 * Backoff (ms) après la 1re, 2e, 3e… échec : 2 s, 5 s, 10 s, 20 s, 30 s, puis plafond 30 s.
 */
export const BACKOFF_DELAYS_MS = [2000, 5000, 10000, 20000, 30000];

/** Plafond du backoff. */
export const BACKOFF_CAP_MS = 30000;

/** Jitter ±20 % pour éviter les tentives synchronisées. */
export const JITTER_RATIO = 0.2;

export function healthUrl() {
  return `${API_BASE}/health`;
}

/**
 * Délai avant la prochaine tentative.
 * @param {number} failureCount nombre d'échecs consécutifs (1 pour le 1er échec)
 * @param {() => number} rand injectable pour les tests
 */
export function nextBackoffDelay(failureCount, rand = Math.random) {
  const idx = Math.max(1, failureCount) - 1;
  const base = BACKOFF_DELAYS_MS[Math.min(idx, BACKOFF_DELAYS_MS.length - 1)];
  const jitter = base * JITTER_RATIO * (rand() * 2 - 1);
  return Math.max(500, Math.round(Math.min(base + jitter, BACKOFF_CAP_MS)));
}

/**
 * Probe unique GET /health.
 * @returns {Promise<{ok: true}|{ok: false, retryable: boolean, status: number|null, error: Error|null}>}
 *  - retryable=true  → erreur temporaire (réseau, timeout, 5xx, 408, 429) → cold start
 *  - retryable=false → le serveur a répondu avec une erreur métier (401/403/404/422…)
 */
export async function probeHealth({
  timeoutMs = HEALTH_TIMEOUT_MS,
  fetchImpl = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null),
} = {}) {
  if (!fetchImpl) {
    return { ok: false, retryable: true, status: null, error: new Error('fetch indisponible') };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(healthUrl(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) return { ok: true };
    if (res.status >= 500 || res.status === 408 || res.status === 429) {
      return { ok: false, retryable: true, status: res.status, error: null };
    }
    // 401/403/404/422… : le backend répond, ce n'est pas un cold start.
    return { ok: false, retryable: false, status: res.status, error: null };
  } catch (err) {
    // Timeout (AbortError) ou erreur réseau (TypeError « Failed to fetch ») → temporaire.
    return { ok: false, retryable: true, status: null, error: err };
  } finally {
    clearTimeout(timer);
  }
}
