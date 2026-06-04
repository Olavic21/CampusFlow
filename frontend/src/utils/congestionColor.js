export function getCongestionLevel(taux) {
  if (taux <= 0.4) return { color: '#22c55e', label: 'Disponible', level: 'disponible', pulse: null };
  if (taux <= 0.7) return { color: '#f59e0b', label: 'Modéré', level: 'modere', pulse: 'slow' };
  if (taux <= 0.9) return { color: '#ef4444', label: 'Chargé', level: 'charge', pulse: 'fast' };
  return { color: '#7c3aed', label: 'Saturé', level: 'sature', pulse: 'flash' };
}

export function getMarkerRadius(capacite) {
  return 6 + Math.sqrt(capacite) * 0.8;
}

/** @deprecated Utiliser getBuildingLucideIcon depuis buildingVisuals */
export function getBuildingIcon() {
  return '';
}

export { getTypeLabel } from './buildingVisuals';
