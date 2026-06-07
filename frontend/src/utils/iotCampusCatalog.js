import CampusLayoutEngine from '../engine/CampusLayoutEngine';
import { CATEGORY_LABELS } from '../engine/buildingMeta';

/**
 * Fusionne capteurs API + bâtiments Digital Twin (dortoirs, services, etc.)
 * pour la supervision IoT alignée sur le campus officiel.
 */
export function buildIoTCampusCatalog(apiSensors = [], geoBuildings = [], occupancy = {}) {
  const campusBuildings = CampusLayoutEngine.getGpsBuildings(occupancy, geoBuildings);
  const sensorByLocationId = new Map(
    apiSensors.map((s) => [s.location_id, s]),
  );

  const entries = campusBuildings.map((b) => {
    const apiSensor = b.geoId != null ? sensorByLocationId.get(b.geoId) : null;
    const occ = occupancy[b.geoId] ?? occupancy[b.id] ?? b.occupancy ?? { taux: b.taux ?? 0 };

    if (apiSensor) {
      return {
        ...apiSensor,
        key: `api-${apiSensor.id}`,
        code: b.code || apiSensor.building,
        category: b.category,
        categoryLabel: b.categoryLabel || CATEGORY_LABELS[b.category] || b.category,
        twinId: b.id,
        geoId: b.geoId,
        capacite: b.capacite,
        taux: occ.taux ?? 0,
        count: occ.count ?? 0,
        hasPhysicalSensor: true,
        coverage: 'capteur',
      };
    }

    return {
      id: null,
      key: `twin-${b.id}`,
      name: `DT-${b.code || b.id}`,
      location_id: b.geoId ?? null,
      building: b.nom,
      code: b.code,
      category: b.category,
      categoryLabel: b.categoryLabel || CATEGORY_LABELS[b.category] || b.category,
      sensor_type: 'virtual',
      status: 'simulation',
      source: 'digital_twin',
      last_seen: null,
      twinId: b.id,
      geoId: b.geoId ?? null,
      capacite: b.capacite,
      taux: occ.taux ?? b.taux ?? 0,
      count: occ.count ?? b.count ?? 0,
      hasPhysicalSensor: false,
      coverage: 'digital_twin',
    };
  });

  return entries.sort((a, b) => {
    const cat = (a.categoryLabel || '').localeCompare(b.categoryLabel || '', 'fr');
    if (cat !== 0) return cat;
    return (a.code || a.building || '').localeCompare(b.code || b.building || '', 'fr');
  });
}

export function summarizeIoTCampus(catalog = []) {
  const physical = catalog.filter((e) => e.hasPhysicalSensor);
  const virtual = catalog.filter((e) => !e.hasPhysicalSensor);
  const online = physical.filter((e) => e.status === 'online');
  const byCategory = {};

  for (const e of catalog) {
    const cat = e.categoryLabel || e.category || 'Autre';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  return {
    totalBuildings: catalog.length,
    physicalSensors: physical.length,
    virtualSensors: virtual.length,
    onlineSensors: online.length,
    categories: byCategory,
  };
}
