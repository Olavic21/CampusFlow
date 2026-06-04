import { useState, useMemo, useCallback } from 'react';
import { buildGraph, edgeWeight } from '../utils/buildGraph';
import { dijkstra } from '../utils/dijkstra';
import { fetchPath, isApiAvailable } from '../services/api';
import {
  buildResultFromPath,
  getRouteLabel,
  ROUTE_COLORS,
} from '../utils/pathResult';

const MAX_COMPARE_ROUTES = 3;

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
  const [routes, setRoutes] = useState([]);
  const [routeMode, setRouteMode] = useState('single');
  const [activeRouteId, setActiveRouteId] = useState(null);
  const [usingApi, setUsingApi] = useState(false);
  const [pathLoading, setPathLoading] = useState(false);

  const activeRoute = useMemo(
    () => routes.find((r) => r.id === activeRouteId) ?? routes[routes.length - 1] ?? null,
    [routes, activeRouteId],
  );

  const result = activeRoute?.result ?? null;

  const computePathLocal = useCallback(() => {
    if (!startId || !endId || startId === endId) return null;
    const getWeight = (from, to, edge) => edgeWeight(from, to, edge, congestionMap);
    const { path, distance } = dijkstra(graph, startId, endId, getWeight);
    if (!path.length) return null;
    return buildResultFromPath(path, buildings, occupancy, distance);
  }, [startId, endId, graph, buildings, congestionMap, occupancy]);

  const registerRoute = useCallback(
    (pathResult, apiUsed) => {
      if (!pathResult?.path?.length) return null;

      const route = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        result: pathResult,
        startId,
        endId,
        label: getRouteLabel(startId, endId, buildings),
        color: ROUTE_COLORS[0],
      };

      setRoutes((prev) => {
        let next;
        if (routeMode === 'compare') {
          next = [...prev, route].slice(-MAX_COMPARE_ROUTES);
          next = next.map((r, i) => ({ ...r, color: ROUTE_COLORS[i % ROUTE_COLORS.length] }));
        } else {
          next = [{ ...route, color: ROUTE_COLORS[0] }];
        }
        return next;
      });

      setActiveRouteId(route.id);
      setUsingApi(apiUsed);
      return route;
    },
    [startId, endId, buildings, routeMode],
  );

  const computePath = useCallback(async () => {
    if (!startId || !endId || startId === endId) return null;

    try {
      const online = await isApiAvailable();
      if (online) {
        const data = await fetchPath(startId, endId, true);
        const res = buildResultFromPath(data.path, buildings, occupancy, data.total_distance);
        res.estimatedMinutes = Math.max(1, Math.round((data.estimated_time || 60) / 60));
        if (res.path?.length) {
          registerRoute(res, true);
          return res;
        }
      }
    } catch {
      /* fallback local */
    }

    const res = computePathLocal();
    if (res?.path?.length) {
      registerRoute(res, false);
      return res;
    }
    return null;
  }, [startId, endId, buildings, occupancy, computePathLocal, registerRoute]);

  const computePathSafe = useCallback(async () => {
    setPathLoading(true);
    try {
      return await computePath();
    } finally {
      setPathLoading(false);
    }
  }, [computePath]);

  const updateActiveRouteResult = useCallback(
    async () => {
      if (!startId || !endId) return null;
      const res = await (async () => {
        try {
          const online = await isApiAvailable();
          if (online) {
            const data = await fetchPath(startId, endId, true);
            const built = buildResultFromPath(data.path, buildings, occupancy, data.total_distance);
            built.estimatedMinutes = Math.max(1, Math.round((data.estimated_time || 60) / 60));
            return built;
          }
        } catch {
          /* local */
        }
        return computePathLocal();
      })();

      if (!res || !activeRouteId) return null;

      setRoutes((prev) =>
        prev.map((r) =>
          r.id === activeRouteId
            ? { ...r, result: res, label: getRouteLabel(r.startId, r.endId, buildings) }
            : r,
        ),
      );
      return res;
    },
    [startId, endId, buildings, occupancy, computePathLocal, activeRouteId],
  );

  const removeRoute = useCallback((id) => {
    setRoutes((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (activeRouteId === id) {
        setActiveRouteId(next[next.length - 1]?.id ?? null);
      }
      return next;
    });
  }, [activeRouteId]);

  /** Réinitialisation complète — permet de recréer un itinéraire immédiatement */
  const clearPath = useCallback(() => {
    setRoutes([]);
    setActiveRouteId(null);
    setStartId(null);
    setEndId(null);
    setUsingApi(false);
    setPathLoading(false);
  }, []);

  const pathIdsOnMap = useMemo(() => {
    const ids = new Set();
    const list = routeMode === 'compare' ? routes : activeRoute ? [activeRoute] : routes;
    for (const r of list) {
      r.result?.path?.forEach((id) => ids.add(id));
    }
    return ids;
  }, [routes, activeRoute, routeMode]);

  return {
    startId,
    endId,
    setStartId,
    setEndId,
    result,
    routes,
    routeMode,
    setRouteMode,
    activeRouteId,
    setActiveRouteId,
    activeRoute,
    computePath: computePathSafe,
    updateActiveRouteResult,
    clearPath,
    resetPathfinder: clearPath,
    removeRoute,
    usingApi,
    pathLoading,
    pathIdsOnMap,
    graph,
  };
}
