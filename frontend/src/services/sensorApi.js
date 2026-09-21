const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
// En production, VITE_API_URL est une URL absolue (backend Oracle Cloud).
const IS_ABSOLUTE_API = /^https?:\/\//i.test(API_BASE);
const DEV_BACKEND = 'http://127.0.0.1:8000';

async function sensorRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json', ...options.headers },
    ...options,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Erreur HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

export async function fetchSensorMode() {
  return sensorRequest('/sensors/mode');
}

export async function fetchSensorDashboard() {
  return sensorRequest('/sensors/status');
}

export async function fetchSensors() {
  return sensorRequest('/sensors');
}

export async function injectTestReading(payload) {
  return sensorRequest('/sensors/test-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getWebSocketUrl() {
  // 1. URL explicite (VITE_WS_URL=wss://api-campusflow.<domaine>)
  if (import.meta.env.VITE_WS_URL) {
    return `${import.meta.env.VITE_WS_URL.replace(/\/$/, '')}/ws/live-occupancy/`;
  }
  // 2. Production : dérivée de l'URL absolue de l'API
  if (IS_ABSOLUTE_API) {
    return `${API_BASE.replace(/^http/i, 'ws')}/ws/live-occupancy/`;
  }
  // 3. Développement : proxy Vite (/ws → 127.0.0.1:8000)
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/live-occupancy/`;
  }
  // 4. Repli explicite (APK Capacitor / LAN) — jamais utilisé dans un build web de prod
  const direct = (import.meta.env.VITE_BACKEND_DIRECT || DEV_BACKEND).replace(/\/$/, '');
  return `${direct.replace(/^http/i, 'ws')}/ws/live-occupancy/`;
}
