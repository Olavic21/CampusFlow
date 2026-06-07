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
        s.location_id === b.id &&
        s.heure === hour &&
        s.minute === (minute >= 30 ? 30 : 0),
    );
    const count = snap?.nombre_etudiants ?? 0;
    map[b.id] = {
      count,
      taux: b.capacite > 0 ? count / b.capacite : 0,
      capacite: b.capacite,
    };
  }
  return map;
}

function mapLiveFluxToOccupancy(data, buildings) {
  const map = {};
  for (const b of buildings) {
    const entry = data.find((d) => d.location_id === b.id);
    const count = entry?.nombre_etudiants ?? 0;
    map[b.id] = {
      count,
      taux: b.capacite > 0 ? count / b.capacite : 0,
      capacite: b.capacite,
    };
  }
  return map;
}

function mapWsReadingsToOccupancy(readings, buildings) {
  const map = {};
  for (const b of buildings) {
    const entry = readings.find((d) => (d.building_id ?? d.location_id) === b.id);
    const count = entry?.occupancy ?? entry?.nombre_etudiants ?? 0;
    map[b.id] = {
      count,
      taux: b.capacite > 0 ? count / b.capacite : 0,
      capacite: b.capacite,
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

/** Provider simulation locale — capteurs.json. */
export function fetchOccupancySimulation(buildings, simulatedTime) {
  const hour = simulatedTime?.hour ?? 9;
  const minute = simulatedTime?.minute ?? 0;
  return {
    raw: loadFromCapteursJson(buildings, hour, minute),
    offline: true,
    source: 'simulation',
  };
}

/** Provider WebSocket — connexion /ws/live-occupancy/. */
export function createWebSocketProvider(buildings, onUpdate, onError) {
  let ws = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    try {
      ws = new WebSocket(getWebSocketUrl());
      ws.onmessage = (event) => {
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
      ws.onerror = () => onError?.();
      ws.onclose = () => {
        if (!closed) setTimeout(connect, 5000);
      };
    } catch {
      onError?.();
    }
  };

  connect();

  return () => {
    closed = true;
    ws?.close();
  };
}

export async function fetchOccupancy(mode, buildings, simulatedTime) {
  if (simulatedTime || mode === 'simulation') {
    return fetchOccupancySimulation(buildings, simulatedTime);
  }
  if (mode === 'websocket') {
    try {
      return await fetchOccupancyApi(buildings);
    } catch {
      return fetchOccupancySimulation(buildings, simulatedTime);
    }
  }
  try {
    return await fetchOccupancyApi(buildings);
  } catch {
    const now = { hour: 9, minute: 0 };
    return fetchOccupancySimulation(buildings, now);
  }
}
