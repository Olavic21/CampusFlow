/**
 * Client API CampusFlow — aligné sur backend FastAPI (pas de préfixe /api).
 * En dev, Vite proxy redirige /api → http://localhost:8000
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TIMEOUT_MS = 5000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...options.headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth() {
  return request('/health');
}

export async function fetchLocations(type = null) {
  const q = type ? `?type=${encodeURIComponent(type)}` : '';
  return request(`/locations${q}`);
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
  try {
    await checkHealth();
    return true;
  } catch {
    return false;
  }
}
