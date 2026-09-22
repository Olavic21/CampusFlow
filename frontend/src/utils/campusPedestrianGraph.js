import { CAMPUS_BUILDINGS, CAMPUS_ROADS, PLAN_VIEWBOX } from '../engine/campusLayoutData';
import CampusLayoutEngine from '../engine/CampusLayoutEngine';
import { buildPlanGpsTransform, resolveBuildingGps } from './planToGps';
import { haversine } from './haversine';

const JUNCTION_THRESHOLD_M = 32;
const BUILDING_ACCESS_MAX_PLAN = 280;
const MAX_BUILDING_ACCESS_EDGES = 5;
const ROAD_DENSIFY_MAX_PLAN = 70;

/** Points intermédiaires sur les longs segments d'allée (graphe plus fin = chemin plus court) */
function densifyRoadPoints(points, maxSpan = ROAD_DENSIFY_MAX_PLAN) {
  if (!points?.length) return [];
  const out = [[points[0][0], points[0][1]]];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const len = planDist(x0, y0, x1, y1);
    const steps = Math.max(1, Math.ceil(len / maxSpan));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
    }
  }
  return out;
}

function addEdge(graph, a, b, distance) {
  if (!graph[a]) graph[a] = [];
  if (!graph[b]) graph[b] = [];
  const existing = graph[a].find((e) => e.to === b);
  if (existing) {
    if (existing.distance <= distance) return;
    graph[a] = graph[a].filter((e) => e.to !== b);
    graph[b] = graph[b].filter((e) => e.to !== a);
  }
  graph[a].push({ to: b, distance });
  graph[b].push({ to: a, distance });
}

function planDist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Clé de nœud graphe : geo:14 ou twin:dortoir-1 */
export function toGraphKey(routeId) {
  if (routeId == null) return null;
  if (typeof routeId === 'string') {
    if (routeId.startsWith('geo:') || routeId.startsWith('twin:') || routeId.startsWith('wp:')) {
      return routeId;
    }
    return `twin:${routeId}`;
  }
  return `geo:${routeId}`;
}

export function graphKeyToRouteId(key) {
  if (!key) return null;
  if (key.startsWith('geo:')) return Number(key.slice(4));
  if (key.startsWith('twin:')) return key.slice(5);
  return key;
}

/** Supprime les points colinéaires pour un tracé plus propre (sans raccourci) */
export function simplifyNodePath(nodePath, nodes) {
  if (!nodePath?.length || nodePath.length <= 2) return nodePath ?? [];

  const getPlan = (id) => {
    const n = nodes[id];
    if (!n) return null;
    if (n.planX != null) return [n.planX, n.planY];
    if (n.building?.center) return n.building.center;
    return null;
  };

  const isColinear = (a, b, c, tol = 0.02) => {
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const ab = planDist(a[0], a[1], b[0], b[1]);
    const bc = planDist(b[0], b[1], c[0], c[1]);
    if (ab < 1 || bc < 1) return true;
    return Math.abs(cross) / (ab * bc) < tol;
  };

  const out = [nodePath[0]];
  for (let i = 1; i < nodePath.length - 1; i++) {
    const prev = getPlan(out[out.length - 1]);
    const cur = getPlan(nodePath[i]);
    const next = getPlan(nodePath[i + 1]);
    if (!prev || !cur || !next || !isColinear(prev, cur, next)) {
      out.push(nodePath[i]);
    }
  }
  out.push(nodePath[nodePath.length - 1]);
  return out;
}

/** Coordonnées plan SVG à partir du nodePath Dijkstra */
export function nodePathToPlanCoords(nodePath, nodes) {
  if (!nodePath?.length) return [];
  return nodePath
    .map((id) => {
      const n = nodes[id];
      if (!n) return null;
      if (n.planX != null && n.planY != null) return [n.planX, n.planY];
      if (n.building?.center) return n.building.center;
      return null;
    })
    .filter(Boolean);
}

/**
 * Graphe piéton campus : allées + accès bâtiments (Dijkstra = plus court chemin).
 */
export function buildCampusPedestrianGraph(geoBuildings = []) {
  const project = buildPlanGpsTransform(CAMPUS_BUILDINGS, geoBuildings);
  const nodes = {};
  const graph = {};
  const waypoints = [];

  const registerNode = (id, lat, lon, meta = {}) => {
    nodes[id] = { id, lat, lon, ...meta };
    if (!graph[id]) graph[id] = [];
  };

  let wpSeq = 0;
  for (const road of CAMPUS_ROADS) {
    let prevId = null;
    for (const [px, py] of densifyRoadPoints(road.points)) {
      const { latitude, longitude } = project(px, py);
      const id = `wp:${road.id}:${wpSeq++}`;
      registerNode(id, latitude, longitude, {
        type: 'waypoint',
        roadId: road.id,
        planX: px,
        planY: py,
      });
      waypoints.push({ id, lat: latitude, lon: longitude, planX: px, planY: py });
      if (prevId) {
        const prev = nodes[prevId];
        const d = haversine(prev.lat, prev.lon, latitude, longitude);
        addEdge(graph, prevId, id, d);
      }
      prevId = id;
    }
  }

  for (let i = 0; i < waypoints.length; i++) {
    for (let j = i + 1; j < waypoints.length; j++) {
      const d = haversine(
        waypoints[i].lat,
        waypoints[i].lon,
        waypoints[j].lat,
        waypoints[j].lon,
      );
      if (d < JUNCTION_THRESHOLD_M) {
        addEdge(graph, waypoints[i].id, waypoints[j].id, d);
      }
    }
  }

  const twinByGeo = new Map(
    CAMPUS_BUILDINGS.filter((b) => b.geoId != null).map((b) => [b.geoId, b]),
  );

  const gpsBuildings = CampusLayoutEngine.getGpsBuildings({}, geoBuildings);
  for (const building of gpsBuildings) {
    if (building.latitude == null || building.longitude == null) continue;

    const twin =
      twinByGeo.get(building.geoId) ||
      CAMPUS_BUILDINGS.find((b) => b.id === building.id || b.id === building.twinId);
    const planX = twin?.center?.[0] ?? building.center?.[0];
    const planY = twin?.center?.[1] ?? building.center?.[1];
    if (planX == null || planY == null) continue;

    const key =
      building.geoId != null ? `geo:${building.geoId}` : `twin:${building.id}`;
    registerNode(key, building.latitude, building.longitude, {
      type: 'building',
      building: { ...building, center: twin?.center ?? building.center },
      routeId: building.geoId ?? building.id,
      planX,
      planY,
    });

    const accessPoints = waypoints
      .map((wp) => ({
        id: wp.id,
        planD: planDist(planX, planY, wp.planX, wp.planY),
      }))
      .filter((c) => c.planD <= BUILDING_ACCESS_MAX_PLAN)
      .sort((a, b) => a.planD - b.planD)
      .slice(0, MAX_BUILDING_ACCESS_EDGES);

    for (const ap of accessPoints) {
      const wp = nodes[ap.id];
      addEdge(
        graph,
        key,
        ap.id,
        haversine(building.latitude, building.longitude, wp.lat, wp.lon),
      );
    }
  }

  return { graph, nodes, waypoints, project, viewBox: PLAN_VIEWBOX };
}

export function getCongestionKeyForNode(nodeId, nodes, congestionMap) {
  const node = nodes[nodeId];
  if (!node) return null;
  if (node.type === 'building' && node.building) {
    const b = node.building;
    const key = b.geoId ?? b.id;
    return congestionMap[key] != null ? key : null;
  }
  return null;
}

/** Distance réelle le long d'un nodePath */
export function pathDistance(nodePath, nodes) {
  let total = 0;
  for (let i = 0; i < nodePath.length - 1; i++) {
    const a = nodes[nodePath[i]];
    const b = nodes[nodePath[i + 1]];
    if (a && b) total += haversine(a.lat, a.lon, b.lat, b.lon);
  }
  return total;
}
