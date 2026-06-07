import {
  CAMPUS_BUILDINGS,
  CAMPUS_ROADS,
  CAMPUS_ZONES,
  PLAN_VIEWBOX,
} from './campusLayoutData';
import { CATEGORY_LABELS, getBuildingMeta } from './buildingMeta';
import { getCongestionLevel } from '../utils/congestionColor';
import {
  buildPlanGpsTransform,
  resolveBuildingGps,
  findNearestGeoId,
} from '../utils/planToGps';

const _byId = new Map(CAMPUS_BUILDINGS.map((b) => [b.id, b]));
const _byCode = new Map(CAMPUS_BUILDINGS.map((b) => [b.code.toLowerCase(), b]));

function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Graphe piéton schématique — nœuds = centres bâtiments + jonctions routes */
function buildSchematicGraph() {
  const nodes = {};
  const junctions = [
    ['j-s', 500, 1280],
    ['j-c', 500, 600],
    ['j-n', 500, 350],
    ['j-e', 850, 500],
    ['j-w', 120, 700],
  ];
  for (const b of CAMPUS_BUILDINGS) {
    if (b.clickable !== false) {
      nodes[b.id] = { id: b.id, pos: b.center, building: true };
    }
  }
  for (const [id, x, y] of junctions) {
    nodes[id] = { id, pos: [x, y], building: false };
  }

  const ids = Object.keys(nodes);
  const graph = {};
  for (const id of ids) graph[id] = [];

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = nodes[ids[i]];
      const b = nodes[ids[j]];
      const d = dist(a.pos, b.pos);
      const maxDist = a.building && b.building ? 280 : 350;
      if (d < maxDist) {
        graph[ids[i]].push({ to: ids[j], distance: d });
        graph[ids[j]].push({ to: ids[i], distance: d });
      }
    }
  }
  return { nodes, graph };
}

const _graphCache = buildSchematicGraph();

export class CampusLayoutEngine {
  static getViewBox() {
    return PLAN_VIEWBOX;
  }

  static getBuildings() {
    return CAMPUS_BUILDINGS;
  }

  static getRoads() {
    return CAMPUS_ROADS;
  }

  static getZones() {
    return CAMPUS_ZONES;
  }

  static getById(id) {
    return _byId.get(id) || null;
  }

  static getByCode(code) {
    return _byCode.get(String(code).toLowerCase().trim()) || null;
  }

  static getCategories() {
    return Object.entries(CATEGORY_LABELS).map(([id, label]) => ({
      id,
      label,
      buildings: CAMPUS_BUILDINGS.filter((b) => b.category === id && b.clickable !== false),
    }));
  }

  /** Recherche intelligente : C1, L31, Restaurant, Bloc Admin… */
  static search(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    return CAMPUS_BUILDINGS.filter((b) => {
      if (b.clickable === false) return false;
      const nom = b.nom.toLowerCase();
      const code = b.code.toLowerCase();
      return nom.includes(q) || code.includes(q) || code.replace('-', '').includes(q.replace('-', ''));
    }).slice(0, 12);
  }

  static hitTest(svgX, svgY) {
    for (let i = CAMPUS_BUILDINGS.length - 1; i >= 0; i--) {
      const b = CAMPUS_BUILDINGS[i];
      if (b.clickable === false) continue;
      if (pointInPolygon(svgX, svgY, b.polygon)) return b;
    }
    return null;
  }

  /** Fusionne occupation API (geoId) + métadonnées twin */
  static enrichBuilding(twin, occupancy = {}, geoBuildings = []) {
    const geoId = twin.geoId;
    let occ = geoId != null ? occupancy[geoId] : null;
    if (!occ && geoId != null) {
      const geo = geoBuildings.find((g) => g.id === geoId);
      if (geo) occ = occupancy[geo.id];
    }
    if (!occ) {
      const hash = twin.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const taux = ((hash % 70) + 10) / 100;
      occ = { count: Math.round(twin.capacite * taux), taux, capacite: twin.capacite };
    }
    const { color, label, level } = getCongestionLevel(occ.taux ?? 0);
    const meta = getBuildingMeta(twin);
    const geo = geoId != null ? geoBuildings.find((g) => g.id === geoId) : null;
    return {
      ...twin,
      ...geo,
      id: twin.id,
      twinId: twin.id,
      geoId,
      nom: twin.nom,
      code: twin.code,
      category: twin.category,
      categoryLabel: CATEGORY_LABELS[twin.category] || twin.category,
      capacite: twin.capacite,
      type: twin.type,
      polygon: twin.polygon,
      center: twin.center,
      latitude: geo?.latitude ?? twin.gps?.latitude ?? twin.latitude ?? null,
      longitude: geo?.longitude ?? twin.gps?.longitude ?? twin.longitude ?? null,
      occupancy: occ,
      count: occ.count ?? 0,
      taux: occ.taux ?? 0,
      color,
      congestionLabel: label,
      level,
      description: meta.description,
      services: meta.services,
      equipment: meta.equipment,
    };
  }

  static enrichAll(occupancy = {}, geoBuildings = []) {
    return CAMPUS_BUILDINGS.filter((b) => b.clickable !== false).map((b) =>
      CampusLayoutEngine.enrichBuilding(b, occupancy, geoBuildings),
    );
  }

  /** Bâtiments GPS : API + twin projetés (dortoirs, services, salles sans geoId) */
  static getGpsBuildings(occupancy = {}, geoBuildings = []) {
    const project = buildPlanGpsTransform(CAMPUS_BUILDINGS, geoBuildings);
    const claimedGeo = new Set();

    const fromApi = geoBuildings
      .filter(
        (g) =>
          Number.isFinite(Number(g.latitude)) && Number.isFinite(Number(g.longitude)),
      )
      .map((geo) => {
        const twin = CAMPUS_BUILDINGS.find((b) => b.geoId === geo.id);
        if (twin) {
          claimedGeo.add(geo.id);
          return CampusLayoutEngine.enrichBuilding(twin, occupancy, geoBuildings);
        }
        const meta = getBuildingMeta(geo);
        const occ = occupancy[geo.id] || { count: 0, taux: 0, capacite: geo.capacite };
        const { color, label, level } = getCongestionLevel(occ.taux ?? 0);
        return {
          ...geo,
          ...meta,
          geoId: geo.id,
          code: geo.code || geo.nom,
          count: occ.count ?? 0,
          taux: occ.taux ?? 0,
          color,
          congestionLabel: label,
          level,
          occupancy: occ,
        };
      });

    const fromPlan = CAMPUS_BUILDINGS.filter(
      (b) => b.clickable !== false && b.geoId == null,
    )
      .map((twin) => {
        const coords = resolveBuildingGps(twin, project);
        if (!coords) return null;
        const enriched = CampusLayoutEngine.enrichBuilding(
          { ...twin, latitude: coords.latitude, longitude: coords.longitude },
          occupancy,
          geoBuildings,
        );
        return {
          ...enriched,
          latitude: coords.latitude,
          longitude: coords.longitude,
          projected: !twin.gps,
        };
      })
      .filter(Boolean);

    return [...fromApi, ...fromPlan];
  }

  /** ID routable (API) pour un bâtiment twin — geoId direct ou point proche */
  static resolveRouteId(building, geoBuildings = []) {
    if (!building) return null;
    if (building.geoId != null) return building.geoId;
    if (building.id != null && _byId.has(building.id)) return building.id;
    if (building.twinId != null) return building.twinId;
    if (building.routeId != null) return building.routeId;
    return null;
  }

  /** Liste complète pour le mode itinéraire (noms twin + routeId) */
  static getRouteBuildings(occupancy = {}, geoBuildings = []) {
    const gps = CampusLayoutEngine.getGpsBuildings(occupancy, geoBuildings);
    return gps
      .map((b) => ({
        ...b,
        routeId: b.geoId ?? b.id,
        routeExact: true,
      }))
      .filter((b) => b.routeId != null && b.latitude != null && b.longitude != null)
      .sort((a, b) => {
        const cat = (a.categoryLabel || '').localeCompare(b.categoryLabel || '', 'fr');
        if (cat !== 0) return cat;
        return (a.code || a.nom || '').localeCompare(b.code || b.nom || '', 'fr');
      });
  }

  /** Résout un bâtiment API ou twin vers objet enrichi */
  static resolve(building, occupancy = {}, geoBuildings = []) {
    if (!building) return null;
    const twin =
      _byId.get(building.id) ||
      _byId.get(building.twinId) ||
      (building.code ? _byCode.get(building.code.toLowerCase()) : null) ||
      (building.geoId ? CAMPUS_BUILDINGS.find((b) => b.geoId === building.geoId) : null) ||
      (building.nom ? CAMPUS_BUILDINGS.find((b) => b.nom === building.nom || b.code === building.nom) : null);
    if (twin) return CampusLayoutEngine.enrichBuilding(twin, occupancy, geoBuildings);
    if (building.latitude != null) {
      return {
        ...building,
        ...getBuildingMeta(building),
        occupancy: occupancy[building.id] || { count: 0, taux: 0 },
      };
    }
    return null;
  }

  static getSchematicGraph() {
    return _graphCache;
  }

  /** Convertit chemin IDs API (numériques) → IDs twin pour affichage plan */
  static apiPathToTwinPath(apiPath, geoBuildings = []) {
    if (!apiPath?.length) return [];
    return apiPath.map((gid) => {
      const twin = CAMPUS_BUILDINGS.find((b) => b.geoId === gid);
      if (twin) return twin.id;
      const geo = geoBuildings.find((g) => g.id === gid);
      if (geo) {
        const match = CAMPUS_BUILDINGS.find(
          (b) => b.nom.toLowerCase() === geo.nom.toLowerCase() || b.code === geo.nom,
        );
        if (match) return match.id;
      }
      return `geo-${gid}`;
    });
  }

  static twinPathToCoords(twinPath) {
    return twinPath
      .map((id) => {
        const n = _graphCache.nodes[id];
        if (n) return n.pos;
        const b = _byId.get(id);
        return b?.center;
      })
      .filter(Boolean);
  }
}

export default CampusLayoutEngine;
