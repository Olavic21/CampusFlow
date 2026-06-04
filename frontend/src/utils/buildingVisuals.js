import {
  GraduationCap,
  FlaskConical,
  Presentation,
  Building2,
  BookOpen,
  HeartPulse,
  UtensilsCrossed,
  Dumbbell,
  Network,
  Monitor,
} from 'lucide-react';

/** Catégorie visuelle (icône + illustration) */
export function inferBuildingCategory(building) {
  const n = (building.nom || '').toLowerCase();
  if (n.includes('infirmerie') || n.includes('santé')) return 'health';
  if (n.includes('biblio')) return 'library';
  if (n.includes('restau') || n.includes('cantine') || n.includes('cafétéria')) return 'restaurant';
  if (n.includes('sport') || n.includes('terrain') || n.includes('gym')) return 'sport';
  if (building.type === 'amphi') return 'amphi';
  if (building.type === 'labo') {
    if (n.includes('réseau') || n.includes('telecom') || n.includes('télécom')) return 'labo_network';
    if (n.includes('info')) return 'labo_it';
    return 'labo';
  }
  if (building.type === 'admin') return 'admin';
  if (building.type === 'salle') return 'salle';
  return 'salle';
}

const ICON_BY_CATEGORY = {
  amphi: GraduationCap,
  labo: FlaskConical,
  labo_network: Network,
  labo_it: Monitor,
  salle: Presentation,
  admin: Building2,
  library: BookOpen,
  health: HeartPulse,
  restaurant: UtensilsCrossed,
  sport: Dumbbell,
};

export function getBuildingLucideIcon(building) {
  const cat = inferBuildingCategory(building);
  return ICON_BY_CATEGORY[cat] || Presentation;
}

export function getTypeLabel(type, building) {
  const cat = building ? inferBuildingCategory(building) : type;
  const map = {
    amphi: 'Amphithéâtre',
    labo: 'Laboratoire',
    labo_network: 'Labo réseaux & télécoms',
    labo_it: 'Labo informatique',
    salle: 'Salle de cours',
    admin: 'Administration',
    library: 'Bibliothèque',
    health: 'Infirmerie',
    restaurant: 'Restauration',
    sport: 'Terrain sportif',
  };
  return map[cat] || map[type] || type;
}

/** Illustration par défaut (SVG dans public) */
export function getBuildingImageUrl(building) {
  const cat = inferBuildingCategory(building);
  const slug = building.image || cat;
  return `/assets/buildings/${slug}.svg`;
}

/** @deprecated — utiliser getBuildingLucideIcon */
export function getBuildingIconEmoji() {
  return null;
}
