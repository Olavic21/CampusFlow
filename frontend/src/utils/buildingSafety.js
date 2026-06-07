import CampusLayoutEngine from '../engine/CampusLayoutEngine';

/**
 * Validation — GPS ou Digital Twin (polygone plan).
 */
export function isValidBuilding(building) {
  if (!building) return false;
  if (typeof building.nom !== 'string' || !building.nom.length) return false;
  if (building.polygon || building.twinId || building.code) return true;
  if (building.id == null && building.twinId == null) return false;
  const lat = Number(building.latitude);
  const lng = Number(building.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

export function resolveBuilding(building, buildings = [], occupancy = {}) {
  if (!building) return null;
  const twin = CampusLayoutEngine.resolve(building, occupancy, buildings);
  if (twin) return twin;
  const found = buildings.find(
    (b) => b.id === building.id || b.id === building.geoId,
  );
  const merged = { ...(found || {}), ...building };
  return isValidBuilding(merged) ? merged : null;
}

export function occupancyKey(building) {
  if (!building) return null;
  return building.geoId ?? building.id;
}

export function isSameBuilding(a, b) {
  if (!a || !b) return false;
  if (a.id != null && b.id != null && a.id === b.id) return true;
  if (a.twinId != null && (a.twinId === b.id || a.twinId === b.twinId)) return true;
  if (a.geoId != null && b.geoId != null && a.geoId === b.geoId) return true;
  return false;
}

export function safeOccupancy(occupancy, buildingOrId) {
  const key =
    typeof buildingOrId === 'object'
      ? occupancyKey(buildingOrId)
      : buildingOrId;
  if (!occupancy || key == null) {
    return { count: 0, taux: 0, capacite: 0 };
  }
  const o = occupancy[key] || buildingOrId?.occupancy;
  return {
    count: o?.count ?? 0,
    taux: o?.taux ?? 0,
    capacite: o?.capacite ?? 0,
  };
}
