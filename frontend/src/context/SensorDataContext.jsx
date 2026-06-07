import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getCongestionLevel } from '../utils/congestionColor';
import CampusLayoutEngine from '../engine/CampusLayoutEngine';
import {
  SENSOR_MODE,
  loadBuildings,
  fetchOccupancy,
  createWebSocketProvider,
} from '../services/sensorProviders';
import { fetchSensorMode, fetchSensorDashboard } from '../services/sensorApi';

const SensorDataContext = createContext(null);

function enrichOccupancy(raw, buildings) {
  const enriched = {};
  for (const b of buildings) {
    const o = raw[b.id] || { count: 0, taux: 0, capacite: b.capacite };
    const taux = o.taux ?? 0;
    const { color, label, level } = getCongestionLevel(taux);
    enriched[b.id] = { ...o, color, label, level };
  }
  for (const twin of CampusLayoutEngine.getBuildings()) {
    if (twin.geoId != null || enriched[twin.id]) continue;
    const hash = twin.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const taux = ((hash % 70) + 10) / 100;
    const count = Math.round((twin.capacite || 20) * taux);
    const { color, label, level } = getCongestionLevel(taux);
    enriched[twin.id] = {
      count,
      taux,
      capacite: twin.capacite,
      color,
      label,
      level,
      simulated: true,
    };
  }
  return enriched;
}

export function SensorDataProvider({ children, simulatedTime = null }) {
  const [buildings, setBuildings] = useState([]);
  const [occupancyRaw, setOccupancyRaw] = useState({});
  const [offline, setOffline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sensorMode, setSensorMode] = useState({
    mode: SENSOR_MODE,
    is_real: false,
    label: 'Mode Simulation',
  });
  const [sensorDashboard, setSensorDashboard] = useState(null);
  const buildingsRef = useRef([]);
  const wsCleanupRef = useRef(null);

  const refreshMeta = useCallback(async () => {
    try {
      const [mode, dash] = await Promise.all([
        fetchSensorMode(),
        fetchSensorDashboard(),
      ]);
      setSensorMode(mode);
      setSensorDashboard(dash);
    } catch {
      setSensorMode({
        mode: SENSOR_MODE,
        is_real: SENSOR_MODE !== 'simulation',
        label: SENSOR_MODE === 'simulation' ? 'Mode Simulation' : 'Données Réelles',
      });
    }
  }, []);

  const fetchLive = useCallback(
    async (bldgs) => {
      const list = bldgs || buildingsRef.current;
      if (!list.length) return;
      const result = await fetchOccupancy(SENSOR_MODE, list, simulatedTime);
      setOccupancyRaw(result.raw);
      setOffline(result.offline ?? false);
      setLoading(false);
    },
    [simulatedTime],
  );

  useEffect(() => {
    let netListener;
    (async () => {
      try {
        const { Network } = await import('@capacitor/network');
        netListener = await Network.addListener('networkStatusChange', (s) => {
          if (!s.connected) setOffline(true);
        });
      } catch {
        /* web */
      }
    })();
    return () => netListener?.remove?.();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { buildings: locs, offline: off } = await loadBuildings();
      if (cancelled) return;
      buildingsRef.current = locs;
      setBuildings(locs);
      setOffline(off);
      await Promise.all([fetchLive(locs), refreshMeta()]);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchLive, refreshMeta]);

  useEffect(() => {
    if (simulatedTime) {
      fetchLive(buildingsRef.current);
      return undefined;
    }

    fetchLive(buildingsRef.current);
    const interval = setInterval(() => fetchLive(buildingsRef.current), 30000);
    const metaInterval = setInterval(refreshMeta, 15000);

    // WebSocket temps réel quand le backend est joignable (simulateur ou capteurs réels).
    const useWs =
      !offline &&
      buildingsRef.current.length &&
      (SENSOR_MODE === 'websocket' || SENSOR_MODE === 'api');

    if (useWs) {
      wsCleanupRef.current?.();
      wsCleanupRef.current = createWebSocketProvider(
        buildingsRef.current,
        (raw) => {
          setOccupancyRaw((prev) => ({ ...prev, ...raw }));
          setOffline(false);
        },
        () => {},
      );
    }

    return () => {
      clearInterval(interval);
      clearInterval(metaInterval);
      wsCleanupRef.current?.();
      wsCleanupRef.current = null;
    };
  }, [simulatedTime, fetchLive, refreshMeta, buildings.length, offline]);

  const occupancy = useMemo(
    () => enrichOccupancy(occupancyRaw, buildings),
    [occupancyRaw, buildings],
  );

  const globalStats = useMemo(() => {
    const campusBuildings = CampusLayoutEngine.getGpsBuildings(occupancy, buildings);
    let total = 0;
    let totalCap = 0;
    let sature = 0;
    let modere = 0;
    let disponible = 0;
    let maxBuilding = null;
    let minBuilding = null;

    for (const b of campusBuildings) {
      const occKey = b.geoId ?? b.id;
      const o = occupancy[occKey] || b.occupancy || { count: b.count ?? 0, taux: b.taux ?? 0 };
      total += o.count ?? 0;
      totalCap += b.capacite ?? 0;
      const taux = o.taux ?? 0;
      if (taux > 0.9) sature++;
      else if (taux > 0.4) modere++;
      else disponible++;
      if (!maxBuilding || taux > (maxBuilding.taux ?? 0)) maxBuilding = { ...b, taux };
      if (!minBuilding || taux < (minBuilding.taux ?? 1)) minBuilding = { ...b, taux };
    }

    return {
      totalStudents: total,
      occupancyRate: totalCap > 0 ? total / totalCap : 0,
      sature,
      modere,
      disponible,
      maxBuilding,
      minBuilding,
      availableRooms: disponible,
      totalRooms: campusBuildings.length,
    };
  }, [buildings, occupancy]);

  const value = useMemo(
    () => ({
      buildings,
      occupancy,
      offline,
      loading,
      globalStats,
      refresh: () => fetchLive(buildingsRef.current),
      sensorMode,
      sensorDashboard,
      refreshMeta,
      source: SENSOR_MODE,
    }),
    [
      buildings,
      occupancy,
      offline,
      loading,
      globalStats,
      fetchLive,
      sensorMode,
      sensorDashboard,
      refreshMeta,
    ],
  );

  return (
    <SensorDataContext.Provider value={value}>{children}</SensorDataContext.Provider>
  );
}

export function useSensorData() {
  const ctx = useContext(SensorDataContext);
  if (!ctx) throw new Error('useSensorData must be used within SensorDataProvider');
  return ctx;
}
