/** Descriptions et métadonnées Digital Twin — SUP'PTIC */
export const BUILDING_META = {
  'bloc-admin': {
    description: "Administration centrale de SUP'PTIC. Accueil des services de direction, scolarité et gestion quotidienne du campus.",
    services: ['Direction', 'Administration', 'Scolarité'],
    equipment: ['Accueil', 'Salles de réunion', 'Archives'],
  },
  adm2: {
    description: "Bâtiment administratif annexe — bureaux pédagogiques et coordination des filières.",
    services: ['Secrétariat pédagogique', 'Coordination filières'],
    equipment: ['Bureaux', 'Salle d\'attente'],
  },
  'controle-financier': {
    description: "Service de contrôle financier et suivi budgétaire de l'établissement.",
    services: ['Contrôle financier', 'Comptabilité interne'],
    equipment: ['Guichets', 'Bureaux'],
  },
  incubateur: {
    description: "Espace d'innovation et d'accompagnement des projets étudiants et startups télécom.",
    services: ['Incubation', 'Mentorat', 'Coworking'],
    equipment: ['Open space', 'Salles de pitch', 'Wi-Fi'],
  },
  amphi1: {
    description: "Principal amphithéâtre du campus — grands cours magistraux, conférences et événements institutionnels.",
    services: ['Cours magistraux', 'Conférences', 'Cérémonies'],
    equipment: ['Vidéoprojecteur', 'Sonorisation', '400+ places'],
  },
  restaurant: {
    description: "Zone de restauration du campus. Point de rassemblement quotidien des étudiants et du personnel.",
    services: ['Restauration', 'Pause déjeuner'],
    equipment: ['Self-service', 'Terrasse'],
  },
  'salle-sport': {
    description: "Salle de sport couverte — activités physiques, entraînements et compétitions intra-campus.",
    services: ['Sport', 'EPS', 'Associations sportives'],
    equipment: ['Terrain indoor', 'Vestiaires'],
  },
  'terrain-foot': {
    description: "Terrain de football en herbe — sports collectifs et événements sportifs du campus.",
    services: ['Football', 'Athlétisme'],
    equipment: ['Pelouse', 'Buts', 'Gradins'],
  },
  'terrain-basket': {
    description: "Terrain de basketball outdoor au cœur du campus — lieu de détente entre les cours.",
    services: ['Basketball', 'Loisirs'],
    equipment: ['Parquet extérieur', 'Paniers'],
  },
  boukarou: {
    description: "Espace convivial traditionnel — pause, discussions et vie associative.",
    services: ['Détente', 'Vie étudiante'],
    equipment: ['Espace ombragé'],
  },
};

export const CATEGORY_LABELS = {
  administration: 'Administration',
  enseignement: 'Enseignement',
  amphi: 'Amphithéâtres',
  dortoir: 'Dortoirs',
  sport: 'Sport',
  service: 'Services',
};

export function getBuildingMeta(building) {
  const key = building?.metaKey || building?.code?.toLowerCase()?.replace(/\s+/g, '-');
  const specific = BUILDING_META[key];
  if (specific) return specific;

  const type = building?.type || building?.category;
  if (type === 'salle' || building?.category === 'enseignement') {
    return {
      description: `Salle de cours ${building?.code || building?.nom} — enseignement des filières télécoms et postes de SUP'PTIC.`,
      services: ['Cours', 'TD', 'Examens'],
      equipment: ['Tableau', 'Vidéoprojecteur', 'Wi-Fi'],
    };
  }
  if (type === 'labo') {
    return {
      description: `Laboratoire technique ${building?.nom} — travaux pratiques et expérimentations.`,
      services: ['TP', 'Projets'],
      equipment: ['Postes de travail', 'Équipements réseau'],
    };
  }
  if (building?.category === 'dortoir') {
    return {
      description: 'Résidence étudiante du campus SUP\'PTIC — hébergement sur site.',
      services: ['Hébergement', 'Gardiennage'],
      equipment: ['Chambres', 'Sanitaires'],
    };
  }
  return {
    description: `${building?.nom || 'Bâtiment'} — espace du campus SUP'PTIC à Yaoundé.`,
    services: [],
    equipment: [],
  };
}
