import { graphKeyToRouteId } from './campusPedestrianGraph';

/** Index du dernier nœud du chemin correspondant à un bâtiment cible */
export function findNodeIndexForBuilding(nodePath, nodes, building) {
  if (!nodePath?.length || !building) return -1;
  const targetIds = new Set(
    [building.id, building.twinId, building.geoId, building.routeId].filter(
      (v) => v != null,
    ),
  );

  let last = -1;
  for (let i = 0; i < nodePath.length; i++) {
    const n = nodes?.[nodePath[i]];
    if (n?.type !== 'building') continue;
    const rid = graphKeyToRouteId(nodePath[i]);
    if (targetIds.has(rid) || targetIds.has(n.building?.id) || targetIds.has(n.building?.geoId)) {
      last = i;
    }
  }
  return last;
}

/** Tronque coords / planCoords jusqu'à l'étape de navigation courante */
export function slicePathToStep(result, stepBuilding, nodes) {
  if (!result?.nodePath?.length) {
    return { coords: result?.coords ?? [], planCoords: result?.planCoords ?? [] };
  }

  const idx = findNodeIndexForBuilding(result.nodePath, nodes, stepBuilding);
  if (idx < 1) {
    return {
      coords: result.coords?.slice(0, Math.max(2, idx + 1)) ?? [],
      planCoords: result.planCoords?.slice(0, Math.max(2, idx + 1)) ?? [],
    };
  }

  return {
    coords: result.coords?.slice(0, idx + 1) ?? [],
    planCoords: result.planCoords?.slice(0, idx + 1) ?? [],
  };
}
