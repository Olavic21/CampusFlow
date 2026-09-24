/**
 * Couche d'abstraction — l'UI ne sait pas si les données viennent
 * de capteurs.json, de l'API ou d'un WebSocket.
 */
import capteursData from '../../data/capteurs.json';
import campusFallback from '../../data/campus.json';
import { fetchLiveFlux, fetchLocations, isApiAvailable } from '../api';
import { getWebSocketUrl } from '../sensorApi';
import { cacheBuildings, getCachedBuildings } from '../offlineStorage';

export const SENSOR_MODE = (import.meta.env.VITE_SENSOR_MODE || 'api').toLowerCase();

function loadFromCapteursJson(buildings, hour, minute) {
  const map = {};
  for (const b of buildings) {
    const snap = capteursData.find(
      (s) =>
        String(s.location_id) === String(b.id) &&
        s.heure === hour &&
        s.minute === (minute >= 30 ? 30 : 0),
    );
    const count = snap?.nombre_etudiants ?? 0;
    map[b.id] = {
      count,
      taux: b.capacite > 0 ? count / b.capacite : 0,
      capacite: b.capacite,
      // Mode démo explicite — courbe historique, jamais un état temps réel
      demo: true,
      simulated: true,
      source: 'simulation',
    };
  }
  return map;
}

function mapLiveFluxToOccupancy(data, buildings) {
  const map = {};
  for (const b of buildings) {
    const entry = data.find((d) => d.location_id === b.id);
    if (!entry) {
      // Aucune lecture récente → état inconnu explicite (pas de faux zéro)
      map[b.id] = { unknown: true, count: null, taux: null, capacite: b.capacite };
      continue;
    }
    const count = entry.nombre_etudiants ?? 0;
    map[b.id] = {
      count,
      taux: b.capacite > 0 ? count / b.capacite : 0,
      capacite: b.capacite,
      stale: entry.is_stale ?? false,
      source: entry.source ?? 'flux',
      asOf: entry.timestamp ?? null,
    };
  }
  return map;
}

function mapWsReadingsToOccupancy(readings, buildings) {
  const map = {};
  for (const b of buildings) {
    const entry = readings.find((d) => (d.building_id ?? d.location_id) === b.id);
    if (!entry) {
      map[b.id] = { unknown: true, count: null, taux: null, capacite: b.capacite };
      continue;
    }
    const count = entry.occupancy ?? entry.nombre_etudiants ?? 0;
    map[b.id] = {
      count,
      taux: b.capacite > 0 ? count / b.capacite : 0,
      capacite: b.capacite,
      stale: entry.is_stale ?? false,
      source: entry.source ?? 'ws',
      asOf: entry.timestamp ?? null,
    };
  }
  return map;
}

export async function loadBuildings() {
  const withTimeout = (promise, ms = 6000) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);

  try {
    const online = await withTimeout(isApiAvailable(), 4000);
    if (online) {
      const locs = await withTimeout(fetchLocations(), 6000);
      if (locs?.length) {
        await cacheBuildings(locs);
        return { buildings: locs, offline: false };
      }
    }
  } catch {
    /* fallback */
  }
  const cached = await getCachedBuildings();
  return { buildings: cached, offline: true };
}

/** Provider API — données via /flux/live (backend sensor-ready). */
export async function fetchOccupancyApi(buildings) {
  const data = await fetchLiveFlux(10);
  return { raw: mapLiveFluxToOccupancy(data, buildings), offline: false };
}

/** Provider simulation locale — capteurs.json (mode démo / fallback offline). */
export function fetchOccupancySimulation(buildings, simulatedTime) {
  const hour = simulatedTime?.hour ?? 9;
  const minute = simulatedTime?.minute ?? 0;
  return {
    raw: loadFromCapteursJson(buildings, hour, minute),
    offline: false,
    demo: true,
    source: 'simulation',
  };
}

/** Backoff de reconnexion WebSocket : 1 s, 2 s, 5 s, 10 s, 20 s, 30 s puis plafond 30 s. */
const WS_BACKOFF_MS = [1000, 2000, 5000, 10000, 20000, 30000];

/**
 * Provider WebSocket temps réel — UNE SEULE connexion par provider.
 * Résilience :
 *  - backoff exponentiel plafonné + jitter à chaque échec/déconnexion
 *  - retryCount remis à 0 après une ouverture réussie
 *  - anti-duplication : jamais de 2e socket si CONNECTING/OPEN
 *  - online/offline : pause des retries hors ligne, reconnexion immédiate au retour
 *  - cleanup complet : timers, listeners et callbacks retirés au démontage
 *  - n'est appelé qu'après readiness backend (géré par SensorDataProvider)
 */
export function createWebSocketProvider(buildings, onUpdate, onError) {
  let ws = null;
  let closed = false;
  let retryCount = 0;
  let retryTimer = null;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const detach = (socket) => {
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
  };

  const scheduleReconnect = () => {
    if (closed || retryTimer) return;
    // Hors ligne : on n'agresse pas le réseau — l'événement `online` relancera.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const base = WS_BACKOFF_MS[Math.min(retryCount, WS_BACKOFF_MS.length - 1)];
    const jitter = base * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.max(500, Math.round(base + jitter));
    retryCount += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (closed) return;
    // Anti-duplication stricte : une seule socket par fonctionnalité.
    if (
      ws &&
      (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }
    clearRetry();
    let socket;
    try {
      socket = new WebSocket(getWebSocketUrl());
    } catch {
      onError?.();
      scheduleReconnect();
      return;
    }
    ws = socket;
    socket.onopen = () => {
      if (closed || socket !== ws) {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        return;
      }
      retryCount = 0; // reconnexion réussie → reset du backoff
    };
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ping') return;
        if (msg.type === 'occupancy_update' || msg.type === 'occupancy_snapshot') {
          const readings = msg.readings || [];
          if (readings.length) {
            onUpdate(mapWsReadingsToOccupancy(readings, buildings));
          }
        }
      } catch {
        /* ignore */
      }
    };
    socket.onerror = () => {
      if (!closed) onError?.();
    };
    socket.onclose = () => {
      if (socket !== ws) return;
      detach(socket);
      ws = null;
      if (closed) return;
      scheduleReconnect();
    };
  };

  const handleOnline = () => {
    if (closed) return;
    retryCount = 0;
    clearRetry();
    connect();
  };

  const handleOffline = () => {
    if (closed) return;
    clearRetry();
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  connect();

  return () => {
    closed = true;
    clearRetry();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
    if (ws) {
      const socket = ws;
      ws = null;
      detach(socket);
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    }
  };
}

export async function fetchOccupancy(mode, buildings, simulatedTime) {
  // Mode démo explicite (slider temps) ou simulation imposée
  if (simulatedTime || mode === 'simulation') {
    return fetchOccupancySimulation(buildings, simulatedTime);
  }
  if (mode === 'websocket') {
    try {
      return await fetchOccupancyApi(buildings);
    } catch {
      return { ...fetchOccupancySimulation(buildings, null), offline: true, demo: false };
    }
  }
  try {
    return await fetchOccupancyApi(buildings);
  } catch {
    // API injoignable : fallback capteurs.json marqué OFFLINE (pas "démo" fun)
    return { ...fetchOccupancySimulation(buildings, null), offline: true, demo: false };
  }
}
