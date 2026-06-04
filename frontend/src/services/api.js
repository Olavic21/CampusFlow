/**
 * Client API CampusFlow — aligné sur backend FastAPI.
 * En dev, le proxy Vite redirige /api → http://127.0.0.1:8000
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 400;
const HEALTH_CACHE_MS = 20000;
const LOCATIONS_CACHE_MS = 120000;

let healthCache = { at: 0, ok: null };
let locationsCache = { at: 0, key: '', data: null };

export class ApiError extends Error {
  constructor(message, { status = null, cause = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.cause = cause;
  }
}

function isRetryable(err) {
  if (err?.name === 'AbortError') return true;
  if (err instanceof ApiError && err.status >= 500) return true;
  if (err instanceof TypeError) return true; // réseau
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...options.headers },
    });
    if (!res.ok) {
      throw new ApiError(`HTTP ${res.status}`, { status: res.status });
    }
    return res.json();
  } catch (err) {
    if (attempt < MAX_RETRIES && isRetryable(err)) {
      await delay(RETRY_DELAY_MS * (attempt + 1));
      return request(path, options, attempt + 1);
    }
    if (err?.name === 'AbortError') {
      throw new ApiError('Délai dépassé — serveur injoignable', { cause: err });
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError('Erreur réseau', { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth() {
  return request('/health');
}

export async function fetchLocations(type = null) {
  const key = type || 'all';
  if (
    locationsCache.data &&
    locationsCache.key === key &&
    Date.now() - locationsCache.at < LOCATIONS_CACHE_MS
  ) {
    return locationsCache.data;
  }
  const q = type ? `?type=${encodeURIComponent(type)}` : '';
  const data = await request(`/locations${q}`);
  locationsCache = { at: Date.now(), key, data };
  return data;
}

export async function fetchLiveFlux(window = 60) {
  return request(`/flux/live?window=${window}`);
}

export async function fetchFluxHistory(locationId, granularity = 'hour') {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 28);
  const params = new URLSearchParams({
    from_date: from.toISOString(),
    to_date: to.toISOString(),
    granularity,
  });
  return request(`/flux/history/${locationId}?${params}`);
}

export async function fetchCongestion(locationId = null) {
  const q = locationId ? `?location_id=${locationId}` : '';
  return request(`/congestion${q}`);
}

export async function fetchPath(fromId, toId, avoidCongestion = true) {
  const params = new URLSearchParams({
    from: String(fromId),
    to: String(toId),
    avoid_congestion: String(avoidCongestion),
  });
  return request(`/path?${params}`);
}

export async function fetchDashboardStats(period = 'week') {
  return request(`/dashboard/stats?period=${period}`);
}

export async function isApiAvailable() {
  if (Date.now() - healthCache.at < HEALTH_CACHE_MS && healthCache.ok !== null) {
    return healthCache.ok;
  }
  try {
    await checkHealth();
    healthCache = { at: Date.now(), ok: true };
    return true;
  } catch {
    healthCache = { at: Date.now(), ok: false };
    return false;
  }
}

export function invalidateApiCache() {
  healthCache = { at: 0, ok: null };
  locationsCache = { at: 0, key: '', data: null };
}
