import { useState, useMemo, useCallback } from 'react';
import { dijkstra } from '../utils/dijkstra';
import {
  buildCampusPedestrianGraph,
  toGraphKey,
  getCongestionKeyForNode,
  simplifyNodePath,
  pathDistance,
} from '../utils/campusPedestrianGraph';
import {
  buildResultFromPath,
  getRouteLabel,
  ROUTE_COLORS,
} from '../utils/pathResult';

const MAX_COMPARE_ROUTES = 3;

function pedestrianEdgeWeight(from, to, edge, nodes, congestionMap) {
  const key = getCongestionKeyForNode(to, nodes, congestionMap);
  const taux = key != null ? congestionMap[key]?.taux ?? 0 : 0;
  return edge.distance * (1 + taux * 0.5);
}

export function usePathfinder(buildings, occupancy) {
  const campusNetwork = useMemo(
    () => buildCampusPedestrianGraph(buildings),
    [buildings],
  );
  const { graph, nodes } = campusNetwork;

  const congestionMap = useMemo(() => {
    const map = {};
    for (const [id, data] of Object.entries(occupancy)) {
      map[id] = { taux: data.taux };
    }
    for (const n of Object.values(nodes)) {
      if (n.type === 'building' && n.building && n.building.geoId == null) {
        map[n.building.id] = {
          taux: n.building.taux ?? 0,
        };
      }
    }
    return map;
  }, [occupancy, nodes]);

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
    if (startId == null || endId == null || startId === endId) return null;
    const startKey = toGraphKey(startId);
    const endKey = toGraphKey(endId);
    const getWeight = (from, to, edge) =>
      pedestrianEdgeWeight(from, to, edge, nodes, congestionMap);
    const { path: rawPath, distance } = dijkstra(graph, startKey, endKey, getWeight);
    if (!rawPath.length) return null;
    const nodePath = simplifyNodePath(rawPath, nodes);
    const exactDist = pathDistance(nodePath, nodes) || distance;
    return buildResultFromPath(nodePath, { nodes, geoBuildings: buildings, occupancy }, exactDist);
  }, [startId, endId, graph, nodes, buildings, congestionMap, occupancy]);

  const registerRoute = useCallback(
    (pathResult) => {
      if (!pathResult?.path?.length) return null;

      const route = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        result: pathResult,
        startId,
        endId,
        label: getRouteLabel(startId, endId, buildings, occupancy),
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
      setUsingApi(false);
      return route;
    },
    [startId, endId, buildings, occupancy, routeMode],
  );

  const computePath = useCallback(async () => {
    if (startId == null || endId == null || startId === endId) return null;
    const res = computePathLocal();
    if (res?.path?.length) {
      registerRoute(res);
      return res;
    }
    return null;
  }, [startId, endId, computePathLocal, registerRoute]);

  const computePathSafe = useCallback(async () => {
    setPathLoading(true);
    try {
      return await computePath();
    } finally {
      setPathLoading(false);
    }
  }, [computePath]);

  const updateActiveRouteResult = useCallback(async () => {
    if (startId == null || endId == null) return null;
    const res = computePathLocal();
    if (!res || !activeRouteId) return null;

    setRoutes((prev) =>
      prev.map((r) =>
        r.id === activeRouteId
          ? { ...r, result: res, label: getRouteLabel(r.startId, r.endId, buildings, occupancy) }
          : r,
      ),
    );
    return res;
  }, [startId, endId, buildings, occupancy, computePathLocal, activeRouteId]);

  const removeRoute = useCallback((id) => {
    setRoutes((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (activeRouteId === id) {
        setActiveRouteId(next[next.length - 1]?.id ?? null);
      }
      return next;
    });
  }, [activeRouteId]);

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
    campusNetwork,
  };
}
