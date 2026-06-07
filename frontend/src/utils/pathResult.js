import { haversine } from './haversine';
import CampusLayoutEngine from '../engine/CampusLayoutEngine';
import { graphKeyToRouteId, nodePathToPlanCoords } from './campusPedestrianGraph';

/**
 * Construit un résultat d'itinéraire le long des allées campus.
 */
export function buildResultFromPath(nodePath, ctx, totalDistance) {
  const { nodes = {}, geoBuildings = [], occupancy = {} } = ctx || {};

  if (!nodePath?.length) {
    return {
      path: [],
      nodePath: [],
      segments: [],
      stepCount: 0,
      totalDistance: 0,
      estimatedMinutes: 0,
      avoidedZones: 0,
      hasSaturated: false,
      coords: [],
      planCoords: [],
    };
  }

  const coords = nodePath
    .map((id) => {
      const n = nodes[id];
      return n ? [n.lat, n.lon] : null;
    })
    .filter(Boolean);

  const planCoords = nodePathToPlanCoords(nodePath, nodes);

  const buildingNodes = nodePath.filter((id) => nodes[id]?.type === 'building');

  const toBuilding = (nodeId) => {
    const n = nodes[nodeId];
    if (!n?.building) return null;
    return CampusLayoutEngine.enrichBuilding(n.building, occupancy, geoBuildings);
  };

  const segments = [];
  let avoided = 0;

  for (let i = 0; i < buildingNodes.length - 1; i++) {
    const fromId = buildingNodes[i];
    const toId = buildingNodes[i + 1];
    const fromB = toBuilding(fromId);
    const toB = toBuilding(toId);
    if (!fromB || !toB) continue;

    const startIdx = nodePath.indexOf(fromId);
    const endIdx = nodePath.indexOf(toId, startIdx + 1);
    let segDist = 0;
    for (let j = startIdx; j < endIdx; j++) {
      const a = nodes[nodePath[j]];
      const b = nodes[nodePath[j + 1]];
      if (a && b) segDist += haversine(a.lat, a.lon, b.lat, b.lon);
    }

    const occKey = toB.geoId ?? toB.id;
    if ((occupancy[occKey]?.taux ?? 0) > 0.9) avoided++;
    segments.push({ from: fromB, to: toB, distance: Math.round(segDist) });
  }

  const path = buildingNodes.map((id) => graphKeyToRouteId(id));

  const hasSaturated = path.some((id) => {
    const key = typeof id === 'number' ? id : null;
    if (key == null) return false;
    return (occupancy[key]?.taux ?? 0) > 0.9;
  });

  return {
    path,
    nodePath,
    segments,
    stepCount: Math.max(0, segments.length),
    totalDistance: Math.round(totalDistance) || 0,
    estimatedMinutes: Math.max(1, Math.round((totalDistance || 0) / 50)),
    avoidedZones: avoided,
    hasSaturated,
    coords,
    planCoords,
  };
}

export function getRouteLabel(startId, endId, buildings, occupancy = {}) {
  const options = CampusLayoutEngine.getRouteBuildings(occupancy, buildings);
  const pick = (id) =>
    options.find((o) => o.routeId === id) ||
    options.find((o) => o.geoId === id) ||
    options.find((o) => o.id === id) ||
    buildings.find((b) => b.id === id);
  const start = pick(startId);
  const end = pick(endId);
  if (start && end) {
    const a = start.code || start.nom;
    const b = end.code || end.nom;
    return `${a} → ${b}`;
  }
  return 'Itinéraire';
}

export const ROUTE_COLORS = ['#2563EB', '#22C55E', '#f97316'];
