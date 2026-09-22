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

const MAX_ROUTES = 3;
const ALT_PENALTY_FACTOR = 1.6;

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function collectEdgeKeys(nodePath) {
  const keys = new Set();
  for (let i = 0; i < nodePath.length - 1; i++) {
    keys.add(edgeKey(nodePath[i], nodePath[i + 1]));
  }
  return keys;
}

/**
 * Poids unifié (Phase 2 — un seul moteur, un seul vocabulaire) :
 *  — profil 'fast' : distance pure (le plus rapide = le plus court)
 *  — profil 'calm' : distance × (1 + taux d'affluence × 0.5)
 */
function pedestrianEdgeWeight(profile, from, to, edge, nodes, congestionMap) {
  let weight = edge.distance;
  if (profile === 'calm') {
    const key = getCongestionKeyForNode(to, nodes, congestionMap);
    const taux = key != null ? congestionMap[key]?.taux ?? 0 : 0;
    weight *= 1 + taux * 0.5;
  }
  return weight;
}

export function usePathfinder(buildings, occupancy, blockedIds = []) {
  const campusNetwork = useMemo(
    () => buildCampusPedestrianGraph(buildings),
    [buildings],
  );
  const { graph, nodes } = campusNetwork;

  const blockedSet = useMemo(
    () => new Set((blockedIds || []).filter((v) => v != null).map(String)),
    [blockedIds],
  );

  // Incidents actifs : les bâtiments bloqués sont retirés du réseau piéton
  // (sauf départ/arrivée — on doit toujours pouvoir rejoindre son point).
  const prunedGraph = useMemo(() => {
    if (!blockedSet.size) return graph;
    const isBlocked = (key) => {
      const n = nodes[key];
      if (n?.type !== 'building') return false;
      const rid = n.building?.geoId ?? n.building?.id;
      return rid != null && blockedSet.has(String(rid));
    };
    const next = {};
    for (const [key, edges] of Object.entries(graph)) {
      if (isBlocked(key)) continue;
      next[key] = edges.filter((e) => !isBlocked(e.to));
    }
    return next;
  }, [graph, nodes, blockedSet]);

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
  const [profile, setProfile] = useState('calm');

  const activeRoute = useMemo(
    () => routes.find((r) => r.id === activeRouteId) ?? routes[routes.length - 1] ?? null,
    [routes, activeRouteId],
  );

  const result = activeRoute?.result ?? null;

  const runDijkstra = useCallback(
    (startKey, endKey, penalized = new Set()) => {
      const getWeight = (from, to, edge) => {
        let w = pedestrianEdgeWeight(profile, from, to, edge, nodes, congestionMap);
        if (penalized.has(edgeKey(from, to))) w *= ALT_PENALTY_FACTOR;
        return w;
      };
      const { path: rawPath, distance } = dijkstra(prunedGraph, startKey, endKey, getWeight);
      if (!rawPath.length) return null;
      const nodePath = simplifyNodePath(rawPath, nodes);
      const exactDist = pathDistance(nodePath, nodes) || distance;
      return buildResultFromPath(nodePath, { nodes, geoBuildings: buildings, occupancy }, exactDist);
    },
    [profile, prunedGraph, nodes, congestionMap, buildings, occupancy],
  );

  const computePathLocal = useCallback(() => {
    if (startId == null || endId == null || startId === endId) return null;
    const startKey = toGraphKey(startId);
    const endKey = toGraphKey(endId);
    if (!prunedGraph[startKey] || !prunedGraph[endKey]) return null;
    return runDijkstra(startKey, endKey);
  }, [startId, endId, prunedGraph, runDijkstra]);

  /**
   * Alternatives RÉELLES (audit P2 — le mode "comparer" n'affichait que le même
   * chemin recalculé) : on pénalise les arêtes déjà empruntées et on relance
   * Dijkstra jusqu'à obtenir des tracés distincts.
   */
  const computeAlternates = useCallback(
    (mainResult) => {
      if (!mainResult?.nodePath?.length || !mainResult.path?.length) return [];
      const startKey = toGraphKey(startId);
      const endKey = toGraphKey(endId);
      const alts = [];
      const seen = new Set([mainResult.nodePath.join('>')]);
      let penalized = collectEdgeKeys(mainResult.nodePath);
      for (let i = 0; i < MAX_ROUTES - 1 && penalized.size; i++) {
        const alt = runDijkstra(startKey, endKey, penalized);
        if (!alt?.nodePath?.length) break;
        const sig = alt.nodePath.join('>');
        if (seen.has(sig)) break;
        seen.add(sig);
        alts.push(alt);
        penalized = new Set([...penalized, ...collectEdgeKeys(alt.nodePath)]);
      }
      return alts;
    },
    [startId, endId, runDijkstra],
  );

  const registerRoutes = useCallback(
    (mainResult, alternates) => {
      if (!mainResult?.path?.length) return null;
      const baseLabel = getRouteLabel(startId, endId, buildings, occupancy);
      const tags = [profile === 'calm' ? 'Le plus calme' : 'Le plus rapide', 'Alternative 1', 'Alternative 2'];
      const all = [mainResult, ...alternates].slice(0, MAX_ROUTES);
      const stamped = all.map((res, i) => ({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        result: res,
        startId,
        endId,
        label: baseLabel,
        tag: all.length > 1 ? tags[i] ?? `Option ${i + 1}` : null,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      }));
      setRoutes(stamped);
      setActiveRouteId(stamped[0].id);
      setUsingApi(false);
      return stamped[0];
    },
    [startId, endId, buildings, occupancy, profile],
  );

  const computePath = useCallback(async () => {
    if (startId == null || endId == null || startId === endId) return null;
    const res = computePathLocal();
    if (!res?.path?.length) return null;
    registerRoutes(res, computeAlternates(res));
    return res;
  }, [startId, endId, computePathLocal, computeAlternates, registerRoutes]);

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
    profile,
    setProfile,
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
