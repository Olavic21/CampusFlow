import { haversine } from './haversine';
import { PLAN_VIEWBOX } from '../engine/campusLayoutData';

/**
 * Projection plan schématique → GPS via bbox du plan complet.
 * Les dortoirs (nord du plan) restent dans l'emprise campus.
 */
export function buildPlanGpsTransform(twinBuildings, geoBuildings) {
  const anchors = [];
  for (const twin of twinBuildings) {
    if (twin.geoId == null || !twin.center) continue;
    const geo = geoBuildings.find((g) => g.id === twin.geoId);
    if (!geo?.latitude) continue;
    anchors.push({
      x: twin.center[0],
      y: twin.center[1],
      lat: geo.latitude,
      lon: geo.longitude,
    });
  }

  if (anchors.length < 2) {
    return (px, py) => ({
      latitude: 3.8695 - (py / PLAN_VIEWBOX.height) * 0.002,
      longitude: 11.5075 + (px / PLAN_VIEWBOX.width) * 0.0025,
    });
  }

  const lats = anchors.map((a) => a.lat);
  const lons = anchors.map((a) => a.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  return (px, py) => ({
    latitude: maxLat - (py / PLAN_VIEWBOX.height) * (maxLat - minLat),
    longitude: minLon + (px / PLAN_VIEWBOX.width) * (maxLon - minLon),
  });
}

export function resolveBuildingGps(twin, projectFn) {
  if (twin?.gps?.latitude != null && twin?.gps?.longitude != null) {
    return { latitude: twin.gps.latitude, longitude: twin.gps.longitude };
  }
  if (!twin?.center || !projectFn) return null;
  const { latitude, longitude } = projectFn(twin.center[0], twin.center[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function projectPlanCenter(twin, projectFn) {
  return resolveBuildingGps(twin, projectFn);
}

export function findNearestGeoId(lat, lon, geoBuildings) {
  let best = null;
  let bestDist = Infinity;
  for (const g of geoBuildings) {
    if (g.latitude == null || g.longitude == null) continue;
    const d = haversine(lat, lon, g.latitude, g.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = g.id;
    }
  }
  return best;
}
