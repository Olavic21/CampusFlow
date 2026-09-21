import { getStoredTokens } from './authApi';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/**
 * Requêtes d'administration — token Bearer obligatoire (Phase 4/5).
 * staff : CRUD capteurs + gestion incidents ; admin : utilisateurs + suppressions.
 */
async function adminRequest(path, options = {}) {
  const { access } = getStoredTokens();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...options.headers,
    },
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

// ── Utilisateurs (admin) ─────────────────────────────────────────────────────
export const listUsers = () => adminRequest('/admin/users');
export const updateUser = (id, payload) =>
  adminRequest(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

// ── Capteurs (staff : création/édition ; admin : suppression) ────────────────
export const listSensorsAuth = () => adminRequest('/sensors');
export const createSensor = (payload) =>
  adminRequest('/sensors', { method: 'POST', body: JSON.stringify(payload) });
export const updateSensor = (id, payload) =>
  adminRequest(`/sensors/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
export const deleteSensor = (id) => adminRequest(`/sensors/${id}`, { method: 'DELETE' });

// ── Incidents (staff : création/clôture) ─────────────────────────────────────
export const listIncidentsAdmin = (activeOnly = false) =>
  adminRequest(`/incidents?active_only=${activeOnly}`);
export const createIncident = (payload) =>
  adminRequest('/incidents', { method: 'POST', body: JSON.stringify(payload) });
export const closeIncident = (id) =>
  adminRequest(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify({ active: false }) });