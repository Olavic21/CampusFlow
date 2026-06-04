import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import campusFallback from '../data/campus.json';
import capteursData from '../data/capteurs.json';
import { fetchLocations, fetchLiveFlux, isApiAvailable } from '../services/api';
import { getCongestionLevel } from '../utils/congestionColor';

function enrichOccupancy(raw, buildings) {
  const enriched = {};
  for (const b of buildings) {
    const o = raw[b.id] || { count: 0, taux: 0, capacite: b.capacite };
    const taux = o.taux ?? 0;
    const { color, label, level } = getCongestionLevel(taux);
    enriched[b.id] = { ...o, color, label, level };
  }
  return enriched;
}

export function useCongestion(simulatedTime = null) {
  const [buildings, setBuildings] = useState(campusFallback);
  const [occupancyRaw, setOccupancyRaw] = useState({});
  const [offline, setOffline] = useState(true);
  const [loading, setLoading] = useState(true);
  const buildingsLoaded = useRef(false);
  const buildingsRef = useRef(campusFallback);

  const loadFromLocal = useCallback((bldgs, hour, minute) => {
    const map = {};
    for (const b of bldgs) {
      const snap = capteursData.find(
        (s) =>
          s.location_id === b.id &&
          s.heure === hour &&
          s.minute === (minute >= 30 ? 30 : 0),
      );
      const count = snap?.nombre_etudiants ?? 0;
      map[b.id] = { count, taux: b.capacite > 0 ? count / b.capacite : 0, capacite: b.capacite };
    }
    return map;
  }, []);

  const loadBuildings = useCallback(async () => {
    if (buildingsLoaded.current) return buildingsRef.current;

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
          buildingsRef.current = locs;
          setBuildings(locs);
          setOffline(false);
          buildingsLoaded.current = true;
          return locs;
        }
      }
    } catch {
      /* fallback local */
    }
    buildingsRef.current = campusFallback;
    setBuildings(campusFallback);
    setOffline(true);
    buildingsLoaded.current = true;
    return campusFallback;
  }, []);

  const fetchLive = useCallback(
    async (bldgs) => {
      const list = bldgs || buildings;
      if (simulatedTime) {
        setOccupancyRaw(loadFromLocal(list, simulatedTime.hour, simulatedTime.minute));
        setLoading(false);
        return;
      }
      try {
        const data = await fetchLiveFlux(60);
        const map = {};
        for (const b of list) {
          const entry = data.find((d) => d.location_id === b.id);
          const count = entry?.nombre_etudiants ?? 0;
          map[b.id] = {
            count,
            taux: b.capacite > 0 ? count / b.capacite : 0,
            capacite: b.capacite,
          };
        }
        setOccupancyRaw(map);
        setOffline(false);
      } catch {
        const now = { hour: 9, minute: 0 };
        setOccupancyRaw(loadFromLocal(list, now.hour, now.minute));
        setOffline(true);
      } finally {
        setLoading(false);
      }
    },
    [buildings, loadFromLocal, simulatedTime],
  );

  const occupancy = useMemo(
    () => enrichOccupancy(occupancyRaw, buildings),
    [occupancyRaw, buildings],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const locs = await loadBuildings();
      if (!cancelled) await fetchLive(locs);
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (simulatedTime) {
      setOccupancyRaw(loadFromLocal(buildings, simulatedTime.hour, simulatedTime.minute));
      return undefined;
    }
    fetchLive();
    const interval = setInterval(() => fetchLive(), 30000);
    return () => clearInterval(interval);
  }, [simulatedTime, loadFromLocal, fetchLive, buildings]);

  const globalStats = useMemo(() => {
    let total = 0;
    let totalCap = 0;
    let sature = 0;
    let modere = 0;
    let disponible = 0;
    let maxBuilding = null;
    let minBuilding = null;

    for (const b of buildings) {
      const o = occupancy[b.id] || { count: 0, taux: 0 };
      total += o.count;
      totalCap += b.capacite;
      if (o.taux > 0.9) sature++;
      else if (o.taux > 0.4) modere++;
      else disponible++;
      if (!maxBuilding || o.taux > (occupancy[maxBuilding.id]?.taux ?? 0)) maxBuilding = b;
      if (!minBuilding || o.taux < (occupancy[minBuilding.id]?.taux ?? 1)) minBuilding = b;
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
      totalRooms: buildings.length,
    };
  }, [buildings, occupancy]);

  return { buildings, occupancy, offline, loading, globalStats, refresh: fetchLive };
}
