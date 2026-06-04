/**
 * Validation et normalisation des bâtiments pour éviter les erreurs au clic.
 */
export function isValidBuilding(building) {
  if (!building || building.id == null) return false;
  const lat = Number(building.latitude);
  const lng = Number(building.longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    typeof building.nom === 'string' &&
    building.nom.length > 0
  );
}

export function resolveBuilding(building, buildings = []) {
  if (!building) return null;
  const found = buildings.find((b) => b.id === building.id);
  const merged = { ...(found || {}), ...building };
  return isValidBuilding(merged) ? merged : null;
}

export function safeOccupancy(occupancy, buildingId) {
  if (!occupancy || buildingId == null) {
    return { count: 0, taux: 0, capacite: 0 };
  }
  const o = occupancy[buildingId];
  return {
    count: o?.count ?? 0,
    taux: o?.taux ?? 0,
    capacite: o?.capacite ?? 0,
  };
}
