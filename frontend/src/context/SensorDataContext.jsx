import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import SensorDataContext from './SensorDataContext';
import { getCongestionLevel, TWIN_DEMO, NODATA_LEVEL, getTwinDemoOccupancy } from '../utils/congestionColor';
import CampusLayoutEngine from '../engine/CampusLayoutEngine';
import {
  SENSOR_MODE,
  loadBuildings,
  fetchOccupancy,
  createWebSocketProvider,
} from '../services/sensorProviders';
import { fetchSensorMode, fetchSensorDashboard } from '../services/sensorApi';
import { fetchIncidents } from '../services/api';

/** Au-delà de ce délai sans mise à jour en ligne, les données sont "anciennes". */
const STALE_MS = 90000;

function enrichOccupancy(raw, buildings) {
  const enriched = {};
  for (const b of buildings) {
    const o = raw[b.id];
    if (!o || o.unknown || o.count == null) {
      // Aucune donnée récente — état neutre explicite, jamais un faux zéro (P0-4)
      enriched[b.id] = {
        unknown: true,
        count: null,
        taux: null,
        capacite: b.capacite,
        color: NODATA_LEVEL.color,
        label: NODATA_LEVEL.label,
        level: 'nodata',
      };
      continue;
    }
    const { color, label, level } = getCongestionLevel(o.taux ?? 0);
    enriched[b.id] = {
      ...o,
      color,
      label,
      level,
      simulated: !!(o.simulated || o.source === 'simulation'),
    };
  }
  // Jumeaux numériques sans capteur → occupation indicative "Démo" (P0-5)
  for (const twin of CampusLayoutEngine.getBuildings()) {
    if (twin.geoId != null || enriched[twin.id]) continue;
    const demo = getTwinDemoOccupancy(twin);
    enriched[twin.id] = {
      ...demo,
      color: TWIN_DEMO.color,
      label: TWIN_DEMO.label,
      level: TWIN_DEMO.level,
    };
  }
  return enriched;
}

export function SensorDataProvider({ children, simulatedTime = null, demo = false }) {
  const [buildings, setBuildings] = useState([]);
  const [occupancyRaw, setOccupancyRaw] = useState({});
  const [offline, setOffline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastDataAt, setLastDataAt] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [sensorMode, setSensorMode] = useState({
    mode: SENSOR_MODE,
    is_real: false,
    label: 'Mode Simulation',
  });
  const [sensorDashboard, setSensorDashboard] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const buildingsRef = useRef([]);
  const wsCleanupRef = useRef(null);

  // Horloge de fraîcheur — re-rendu léger toutes les 15 s pour recalculer `stale`
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const refreshMeta = useCallback(async () => {
    try {
      const [mode, dash, incs] = await Promise.all([
        fetchSensorMode(),
        fetchSensorDashboard(),
        fetchIncidents(true).catch(() => null),
      ]);
      setSensorMode(mode);
      setSensorDashboard(dash);
      if (Array.isArray(incs)) setIncidents(incs);
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
      const result = await fetchOccupancy(
        demo ? 'simulation' : SENSOR_MODE,
        list,
        demo ? simulatedTime : null,
      );
      setOccupancyRaw(result.raw);
      setOffline(result.offline ?? false);
      setLastDataAt(Date.now());
      setLoading(false);
    },
    [simulatedTime, demo],
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
    if (demo) {
      // Mode démo — pas de polling réseau ni de WebSocket
      fetchLive(buildingsRef.current);
      return undefined;
    }

    fetchLive(buildingsRef.current);
    const interval = setInterval(() => fetchLive(buildingsRef.current), 30000);
    const metaInterval = setInterval(refreshMeta, 60000);

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
          setLastDataAt(Date.now());
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
  }, [demo, simulatedTime, fetchLive, refreshMeta, buildings.length, offline]);

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
    let knownBuildings = 0;

    for (const b of campusBuildings) {
      const occKey = b.geoId ?? b.id;
      const o = occupancy[occKey] || b.occupancy || { count: b.count ?? 0, taux: b.taux ?? 0 };
      // Honnêteté des données : jumeaux "Démo" et bâtiments sans lecture exclus
      if (o.simulated || o.unknown || o.count == null) continue;
      knownBuildings += 1;
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
      // Couverture de données réelles affichée (0..1) — transparence P0-4
      knownBuildings,
      dataCoverage: campusBuildings.length ? knownBuildings / campusBuildings.length : 0,
    };
  }, [buildings, occupancy]);

  const stale =
    !demo && !offline && lastDataAt != null && nowTick - lastDataAt > STALE_MS;

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
      demo,
      stale,
      lastDataAt,
      incidents,
      blockedLocationIds: (incidents || []).map((i) => i.location_id),
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
      demo,
      stale,
      lastDataAt,
    ],
  );

  return (
    <SensorDataContext.Provider value={value}>{children}</SensorDataContext.Provider>
  );
}
