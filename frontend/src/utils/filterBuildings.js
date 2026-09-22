import { getCongestionLevel } from './congestionColor';
import { occupancyKey } from './buildingSafety';

function resolveFilterType(building) {
  if (building.type) return building.type;
  if (building.category === 'administration') return 'admin';
  if (building.category === 'dortoir') return 'dortoir';
  if (building.category === 'service') return 'service';
  if (building.category === 'sport') return 'sport';
  if (building.category === 'amphi') return 'amphi';
  if (building.category === 'enseignement') return 'salle';
  return building.type;
}

/**
 * Filtre les bâtiments selon type et niveau de congestion.
 */
export function filterBuildings(buildings, filters, occupancy) {
  return buildings.filter((b) => {
    if (!filters.types.includes(resolveFilterType(b))) return false;
    const key = occupancyKey(b);
    const taux = occupancy[key]?.taux ?? b.taux ?? 0;
    const { level } = getCongestionLevel(taux);
    if (filters.congestion === 'disponible' && level !== 'disponible') return false;
    if (filters.congestion === 'charge' && level !== 'charge') return false;
    if (filters.congestion === 'sature' && level !== 'sature') return false;
    return true;
  });
}
