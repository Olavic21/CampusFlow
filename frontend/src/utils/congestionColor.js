export function getCongestionLevel(taux) {
  if (taux <= 0.4) return { color: '#22c55e', label: 'Disponible', level: 'disponible', pulse: null };
  if (taux <= 0.7) return { color: '#f59e0b', label: 'Modéré', level: 'modere', pulse: 'slow' };
  if (taux <= 0.9) return { color: '#ef4444', label: 'Chargé', level: 'charge', pulse: 'fast' };
  return { color: '#7c3aed', label: 'Saturé', level: 'sature', pulse: 'flash' };
}

/** Niveau "Aucune donnée" — neutre, jamais confondu avec un état réel */
export const NODATA_LEVEL = {
  color: '#94a3b8',
  label: '—',
  level: 'nodata',
  pulse: null,
};

/** Jumeau numérique sans capteur — occupation indicative, JAMAIS un état réel */
export const TWIN_DEMO = {
  color: '#64748b',
  label: 'Démo',
  level: 'twin',
  pulse: null,
};

/**
 * Occupation indicative d'un jumeau sans capteur (courbe déterministe).
 * Toujours marquée `simulated: true` — exclue des statistiques globales.
 */
export function getTwinDemoOccupancy(twin) {
  const hash = String(twin?.id ?? '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  const taux = ((hash % 70) + 10) / 100;
  return {
    count: Math.round((twin?.capacite ?? 0) * taux),
    taux,
    capacite: twin?.capacite ?? 0,
    simulated: true,
    demo: true,
  };
}

export function getMarkerRadius(capacite) {
  return 6 + Math.sqrt(capacite) * 0.8;
}

/** @deprecated Utiliser getBuildingLucideIcon depuis buildingVisuals */
export function getBuildingIcon() {
  return '';
}

export { getTypeLabel } from './buildingVisuals';
