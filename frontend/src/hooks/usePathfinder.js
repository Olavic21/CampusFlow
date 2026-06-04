import { useState, useMemo, useCallback } from 'react';
import { buildGraph, edgeWeight } from '../utils/buildGraph';
import { dijkstra } from '../utils/dijkstra';
import { haversine } from '../utils/haversine';
import { fetchPath, isApiAvailable } from '../services/api';

function buildResultFromPath(path, buildings, occupancy, totalDistance) {
  const segments = [];
  let avoided = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const from = buildings.find((b) => b.id === path[i]);
    const to = buildings.find((b) => b.id === path[i + 1]);
    const dist = haversine(from.latitude, from.longitude, to.latitude, to.longitude);
    if ((occupancy[path[i + 1]]?.taux ?? 0) > 0.9) avoided++;
    segments.push({ from, to, distance: Math.round(dist) });
  }
  const hasSaturated = path.some((id) => (occupancy[id]?.taux ?? 0) > 0.9);
  return {
    path,
    segments,
    totalDistance: Math.round(totalDistance),
    estimatedMinutes: Math.max(1, Math.round(totalDistance / 50)),
    avoidedZones: avoided,
    hasSaturated,
    coords: path.map((id) => {
      const b = buildings.find((bld) => bld.id === id);
      return [b.latitude, b.longitude];
    }),
  };
}

export function usePathfinder(buildings, occupancy) {
  const graph = useMemo(() => buildGraph(buildings), [buildings]);

  const congestionMap = useMemo(() => {
    const map = {};
    for (const [id, data] of Object.entries(occupancy)) {
      map[id] = { taux: data.taux };
    }
    return map;
  }, [occupancy]);

  const [startId, setStartId] = useState(null);
  const [endId, setEndId] = useState(null);
  const [result, setResult] = useState(null);
  const [usingApi, setUsingApi] = useState(false);

  const computePathLocal = useCallback(() => {
    if (!startId || !endId || startId === endId) return null;
    const getWeight = (from, to, edge) => edgeWeight(from, to, edge, congestionMap);
    const { path, distance } = dijkstra(graph, startId, endId, getWeight);
    if (!path.length) return null;
    return buildResultFromPath(path, buildings, occupancy, distance);
  }, [startId, endId, graph, buildings, congestionMap, occupancy]);

  const computePath = useCallback(async () => {
    if (!startId || !endId || startId === endId) return null;

    try {
      const online = await isApiAvailable();
      if (online) {
        const data = await fetchPath(startId, endId, true);
        const res = buildResultFromPath(data.path, buildings, occupancy, data.total_distance);
        res.estimatedMinutes = Math.max(1, Math.round(data.estimated_time / 60));
        setResult(res);
        setUsingApi(true);
        return res;
      }
    } catch { /* fallback local */ }

    const res = computePathLocal();
    setResult(res);
    setUsingApi(false);
    return res;
  }, [startId, endId, buildings, occupancy, computePathLocal]);

  const clearPath = useCallback(() => {
    setResult(null);
    setStartId(null);
    setEndId(null);
    setUsingApi(false);
  }, []);

  return {
    startId,
    endId,
    setStartId,
    setEndId,
    result,
    computePath,
    clearPath,
    usingApi,
    graph,
  };
}
