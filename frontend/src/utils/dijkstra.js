export function dijkstra(graph, startId, endId, getWeight) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  const nodes = Object.keys(graph);

  for (const id of nodes) {
    dist[id] = Infinity;
    prev[id] = null;
  }
  dist[String(startId)] = 0;

  while (visited.size < nodes.length) {
    let u = null;
    let minDist = Infinity;
    for (const id of nodes) {
      if (!visited.has(id) && dist[id] < minDist) {
        minDist = dist[id];
        u = id;
      }
    }
    if (u === null || u === String(endId)) break;
    visited.add(u);

    for (const edge of graph[u] || []) {
      const v = String(edge.to);
      const w = getWeight ? getWeight(u, v, edge) : edge.weight;
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
      }
    }
  }

  const path = [];
  let cur = String(endId);
  if (prev[cur] === null && cur !== String(startId)) return { path: [], distance: Infinity };

  while (cur) {
    path.unshift(Number(cur));
    cur = prev[cur];
  }

  return { path, distance: dist[String(endId)] };
}
