import { getCongestionLevel } from './congestionColor';

/**
 * Filtre les bâtiments selon type et niveau de congestion.
 */
export function filterBuildings(buildings, filters, occupancy) {
  return buildings.filter((b) => {
    if (!filters.types.includes(b.type)) return false;
    const taux = occupancy[b.id]?.taux ?? 0;
    const { level } = getCongestionLevel(taux);
    if (filters.congestion === 'disponible' && level !== 'disponible') return false;
    if (filters.congestion === 'charge' && level !== 'charge') return false;
    if (filters.congestion === 'sature' && level !== 'sature') return false;
    return true;
  });
}
