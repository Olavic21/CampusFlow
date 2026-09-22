/** Tas minimaire pour Dijkstra — O(log n) par extraction */
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(nodeId, priority) {
    this.heap.push([priority, nodeId]);
    this.bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0][1];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent][0] <= this.heap[i][0]) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  bubbleDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left][0] < this.heap[smallest][0]) smallest = left;
      if (right < n && this.heap[right][0] < this.heap[smallest][0]) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

/**
 * Dijkstra — clés de nœuds string ou number (graphe piéton campus).
 */
export function dijkstra(graph, startId, endId, getWeight) {
  const dist = {};
  const prev = {};
  const visited = new Set();
  const startKey = String(startId);
  const endKey = String(endId);

  for (const id of Object.keys(graph)) {
    dist[id] = Infinity;
    prev[id] = null;
  }
  if (!(startKey in dist) || !(endKey in dist)) {
    return { path: [], distance: Infinity };
  }

  dist[startKey] = 0;
  const heap = new MinHeap();
  heap.push(startKey, 0);

  while (heap.heap.length > 0) {
    const u = heap.pop();
    if (u === null || visited.has(u)) continue;
    if (u === endKey) break;
    visited.add(u);

    for (const edge of graph[u] || []) {
      const v = String(edge.to);
      if (visited.has(v)) continue;
      const w = getWeight ? getWeight(u, v, edge) : (edge.distance ?? edge.weight ?? 1);
      const alt = dist[u] + w;
      if (alt < dist[v]) {
        dist[v] = alt;
        prev[v] = u;
        heap.push(v, alt);
      }
    }
  }

  const path = [];
  let cur = endKey;
  if (prev[cur] === null && cur !== startKey) return { path: [], distance: Infinity };

  while (cur) {
    const numeric = Number(cur);
    path.unshift(Number.isFinite(numeric) && String(numeric) === cur ? numeric : cur);
    cur = prev[cur];
  }

  return { path, distance: dist[endKey] };
}
