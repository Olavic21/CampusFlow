import { haversine } from './haversine';

const MAX_EDGE_DIST = 120;

export function buildGraph(buildings) {
  const graph = {};

  for (const b of buildings) {
    graph[String(b.id)] = [];
  }

  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const a = buildings[i];
      const b = buildings[j];
      const dist = haversine(a.latitude, a.longitude, b.latitude, b.longitude);
      if (dist < MAX_EDGE_DIST) {
        graph[String(a.id)].push({ to: b.id, distance: dist });
        graph[String(b.id)].push({ to: a.id, distance: dist });
      }
    }
  }

  return graph;
}

export function edgeWeight(fromId, toId, edge, congestionMap) {
  const taux = congestionMap?.[toId]?.taux ?? 0;
  return edge.distance * (1 + taux * 0.5);
}
