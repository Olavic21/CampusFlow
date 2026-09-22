/**
 * Plan officiel SUP'PTIC — coordonnées schématiques (viewBox 0 0 1000 1400).
 * Source de vérité spatiale pour le Digital Twin.
 */
function r(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

function cx(poly) {
  return poly.reduce((s, p) => s + p[0], 0) / poly.length;
}
function cy(poly) {
  return poly.reduce((s, p) => s + p[1], 0) / poly.length;
}

function b(id, code, nom, category, type, capacite, x, y, w, h, geoId = null, metaKey = null, gps = null) {
  const polygon = r(x, y, w, h);
  return {
    id,
    code,
    nom,
    category,
    type,
    capacite,
    polygon,
    center: [cx(polygon), cy(polygon)],
    geoId,
    metaKey: metaKey || id,
    gps,
    clickable: category !== 'sport' || id.startsWith('terrain'),
  };
}

/** Routes internes (polylignes) */
export const CAMPUS_ROADS = [
  { id: 'rd-main', points: [[80, 1280], [400, 1280], [500, 1100], [500, 600], [350, 450], [500, 350], [750, 350], [850, 500], [900, 800], [920, 1200]] },
  { id: 'rd-west', points: [[80, 1280], [80, 900], [120, 700], [200, 550], [350, 450]] },
  { id: 'rd-east', points: [[750, 350], [850, 500], [900, 800], [920, 1200], [920, 1350]] },
  { id: 'rd-south', points: [[400, 1280], [700, 1280], [920, 1350]] },
  // Accès dortoirs nord → jonction rd-west
  { id: 'rd-dortoirs-n', points: [[125, 227], [200, 227], [545, 227], [350, 450]] },
  // Accès dortoirs est → rd-east
  { id: 'rd-dortoirs-e', points: [[765, 707], [862, 707], [900, 800]] },
  // Accès services (restaurant, sport)
  { id: 'rd-services', points: [[915, 345], [860, 300], [860, 180]] },
];

/** Zones vertes et sport (non cliquables sauf terrains) */
export const CAMPUS_ZONES = [
  { id: 'zone-foot', type: 'sport', nom: 'Terrain de football', polygon: r(120, 30, 760, 190), color: '#22c55e33' },
  { id: 'zone-basket', type: 'sport', nom: 'Terrain de basketball', polygon: r(310, 280, 380, 170), color: '#3b82f633' },
  { id: 'zone-green-n', type: 'green', polygon: r(50, 220, 900, 60) },
  { id: 'zone-green-c', type: 'green', polygon: r(50, 550, 400, 200) },
];

const ADMIN = [
  b('bloc-admin', 'Bloc Admin', 'Bloc Admin', 'administration', 'admin', 80, 700, 1180, 260, 180, 1, 'bloc-admin'),
  b('adm2', 'ADM2', 'ADM2', 'administration', 'admin', 40, 80, 240, 100, 70, 2, 'adm2'),
  b('mast2', 'MAST2', 'MAST2', 'administration', 'admin', 35, 200, 240, 90, 60, 2),
  b('controle-financier', 'Contrôle Financier', 'Contrôle Financier', 'administration', 'admin', 30, 780, 420, 120, 70, 3, 'controle-financier'),
  b('incubateur', 'Incubateur', 'Incubateur', 'administration', 'admin', 60, 300, 300, 200, 100, null, 'incubateur', {
    latitude: 3.86972,
    longitude: 11.50815,
  }),
  b('agence-comptable', 'Agence Comptable', 'Agence Comptable', 'administration', 'admin', 20, 820, 1320, 100, 50, 3),
];

const AMPHI = [
  b('amphi1', 'Amphi 1', 'Amphi 1', 'amphi', 'amphi', 200, 720, 540, 200, 120, 6, 'amphi1'),
];

const SERVICES = [
  b('restaurant', 'Restaurant', 'Restaurant', 'service', 'service', 200, 860, 300, 110, 90, null, 'restaurant', {
    latitude: 3.86988,
    longitude: 11.50855,
  }),
  b('salle-sport', 'Salle de Sport', 'Salle de Sport', 'service', 'service', 80, 860, 180, 110, 80, null, 'salle-sport', {
    latitude: 3.86992,
    longitude: 11.50835,
  }),
];

const SPORT = [
  b('terrain-foot', 'Football', 'Terrain de football', 'sport', 'sport', 500, 120, 30, 760, 190, null, 'terrain-foot'),
  b('terrain-basket', 'Basketball', 'Terrain de basketball', 'sport', 'sport', 100, 310, 280, 380, 170, null, 'terrain-basket'),
  b('boukarou', 'Boukarou', 'Boukarou', 'service', 'service', 50, 280, 620, 80, 80, null, 'boukarou'),
];

// Salles C — disposition plan officiel
const C_ROOMS = [
  ['C1', 14, 620, 1220, 55, 45], ['C2', 15, 680, 1220, 55, 45], ['C3', 16, 740, 1220, 55, 45],
  ['C4', 17, 560, 1160, 55, 45], ['C5', 18, 620, 1160, 55, 45], ['C6', 19, 680, 1160, 55, 45],
  ['C7-8', 20, 440, 1220, 70, 45], ['C9', 21, 440, 1160, 55, 45],
  ['C10', 22, 360, 1100, 55, 45], ['C11', 36, 300, 1100, 55, 45],
  ['C12', 37, 240, 1040, 55, 45], ['C13', 23, 300, 1040, 55, 45],
  ['C15', null, 60, 1220, 50, 45], ['C16', null, 60, 1160, 50, 45],
  ['C17', null, 60, 1100, 50, 45], ['C18', null, 60, 1040, 50, 45],
].map(([code, geoId, x, y, w, h]) =>
  b(`c-${code.toLowerCase()}`, code, code, 'enseignement', 'salle', 40, x, y, w, h, geoId),
);

// Salles L
const L_ROOMS = [
  ['L13', 27, 60, 900, 50, 42], ['L14', 24, 60, 850, 50, 42], ['L15', 25, 60, 800, 50, 42],
  ['L16', 26, 60, 750, 50, 42], ['L17', 26, 60, 700, 50, 42],
  ['L18', 28, 60, 1040, 50, 42], ['L19', 29, 120, 1040, 50, 42],
  ['L20', 30, 180, 1040, 50, 42], ['L21', 31, 240, 1040, 50, 42],
  ['L22', 32, 300, 980, 50, 42], ['L23', 33, 360, 980, 50, 42], ['L24', 34, 420, 980, 50, 42],
  ['L25', 8, 60, 480, 45, 38], ['L26', 9, 110, 480, 45, 38], ['L27', 10, 160, 480, 45, 38],
  ['L28', 11, 210, 480, 45, 38], ['L29', 12, 260, 480, 45, 38], ['L30', 13, 310, 480, 45, 38],
  ['L31', 35, 400, 560, 120, 80],
  ['T', 36, 360, 480, 40, 38],
].map(([code, geoId, x, y, w, h]) =>
  b(`l-${code.toLowerCase()}`, code, code, 'enseignement', code.startsWith('L') && Number(code.slice(1)) <= 17 ? 'labo' : 'salle', 35, x, y, w, h, geoId),
);

const I_ROOMS = [
  b('i16', 'I16', 'I16', 'enseignement', 'salle', 30, 500, 300, 45, 40, 5),
  b('i17', 'I17', 'I17', 'enseignement', 'salle', 30, 560, 300, 45, 40, 5),
  b('i21', 'I21', 'I21', 'enseignement', 'salle', 40, 620, 300, 70, 50, 7),
];

const EXTRA = [
  b('s122', '122', '122', 'enseignement', 'salle', 25, 60, 1320, 45, 40),
  b('s123', '123', '123', 'enseignement', 'salle', 25, 110, 1320, 45, 40),
  b('s124', '124', '124', 'enseignement', 'salle', 25, 160, 1320, 45, 40),
];

// Dortoirs — coordonnées GPS calibrées (zone nord / est du campus)
const DORTOIR_GPS = [
  { latitude: 3.87032, longitude: 11.50735 },
  { latitude: 3.87028, longitude: 11.50775 },
  { latitude: 3.87034, longitude: 11.5082 },
  { latitude: 3.8703, longitude: 11.50865 },
  { latitude: 3.86978, longitude: 11.5091 },
  { latitude: 3.86968, longitude: 11.5094 },
  { latitude: 3.86988, longitude: 11.50895 },
];

const DORTOIRS = [
  [80, 200, 90, 55], [200, 180, 85, 50], [500, 200, 90, 55], [620, 220, 85, 50],
  [720, 680, 90, 55], [820, 720, 85, 50], [860, 620, 90, 55],
].map(([x, y, w, h], i) =>
  b(
    `dortoir-${i + 1}`,
    `Dortoir ${i + 1}`,
    `Dortoir ${i + 1}`,
    'dortoir',
    'dortoir',
    120,
    x,
    y,
    w,
    h,
    null,
    `dortoir-${i + 1}`,
    DORTOIR_GPS[i],
  ),
);

export const CAMPUS_BUILDINGS = [
  ...ADMIN,
  ...AMPHI,
  ...SERVICES,
  ...SPORT.filter((s) => s.id !== 'terrain-foot' && s.id !== 'terrain-basket'),
  ...C_ROOMS,
  ...L_ROOMS,
  ...I_ROOMS,
  ...EXTRA,
  ...DORTOIRS,
  ...SPORT.filter((s) => s.id === 'terrain-foot' || s.id === 'terrain-basket'),
];

export const PLAN_VIEWBOX = { width: 1000, height: 1400 };
