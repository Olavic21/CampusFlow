import { haversine } from './haversine';

/**
 * Construit un résultat d'itinéraire robuste (aucun crash si bâtiment manquant).
 */
export function buildResultFromPath(path, buildings, occupancy, totalDistance) {
  if (!path?.length) {
    return {
      path: [],
      segments: [],
      stepCount: 0,
      totalDistance: 0,
      estimatedMinutes: 0,
      avoidedZones: 0,
      hasSaturated: false,
      coords: [],
    };
  }

  const byId = new Map(buildings.map((b) => [b.id, b]));
  const segments = [];
  let avoided = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const from = byId.get(path[i]);
    const to = byId.get(path[i + 1]);
    if (!from || !to) continue;

    const dist = haversine(from.latitude, from.longitude, to.latitude, to.longitude);
    if ((occupancy[path[i + 1]]?.taux ?? 0) > 0.9) avoided++;

    segments.push({ from, to, distance: Math.round(dist) });
  }

  const hasSaturated = path.some((id) => (occupancy[id]?.taux ?? 0) > 0.9);
  const coords = path
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((b) => [b.latitude, b.longitude]);

  return {
    path,
    segments,
    stepCount: Math.max(0, path.length - 1),
    totalDistance: Math.round(totalDistance) || 0,
    estimatedMinutes: Math.max(1, Math.round((totalDistance || 0) / 50)),
    avoidedZones: avoided,
    hasSaturated,
    coords,
  };
}

export function getRouteLabel(startId, endId, buildings) {
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const start = byId.get(startId);
  const end = byId.get(endId);
  if (start && end) return `${start.nom} → ${end.nom}`;
  return 'Itinéraire';
}

export const ROUTE_COLORS = ['#2563EB', '#22C55E', '#f97316'];
