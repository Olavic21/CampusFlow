const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

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
  if (import.meta.env.VITE_WS_URL) {
    return `${import.meta.env.VITE_WS_URL.replace(/\/$/, '')}/ws/live-occupancy/`;
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/live-occupancy/`;
  }
  const direct = (import.meta.env.VITE_BACKEND_DIRECT || 'http://127.0.0.1:8000').replace(
    /\/$/,
    '',
  );
  return `${direct.replace(/^http/, 'ws')}/ws/live-occupancy/`;
}
