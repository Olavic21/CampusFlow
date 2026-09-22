import { describe, it, expect } from 'vitest';
import { dijkstra } from '../dijkstra';

describe('dijkstra', () => {
  const graph = {
    '1': [{ to: '2', weight: 10 }],
    '2': [{ to: '1', weight: 10 }, { to: '3', weight: 5 }],
    '3': [{ to: '2', weight: 5 }],
  };

  it('finds shortest path between two nodes', () => {
    const { path, distance } = dijkstra(graph, 1, 3);
    expect(path).toEqual([1, 2, 3]);
    expect(distance).toBe(15);
  });

  it('returns empty path when destination unreachable', () => {
    const isolated = {
      '1': [{ to: '2', weight: 1 }],
      '2': [{ to: '1', weight: 1 }],
      '9': [],
    };
    const { path, distance } = dijkstra(isolated, 1, 9);
    expect(path).toEqual([]);
    expect(distance).toBe(Infinity);
  });

  it('respects custom edge weights', () => {
    const g = {
      '1': [
        { to: '2', weight: 100 },
        { to: '3', weight: 1 },
      ],
      '2': [{ to: '1', weight: 100 }, { to: '3', weight: 1 }],
      '3': [
        { to: '1', weight: 1 },
        { to: '2', weight: 1 },
      ],
    };
    const getWeight = (_f, _t, edge) => edge.weight;
    const { path, distance } = dijkstra(g, 1, 2, getWeight);
    expect(path).toEqual([1, 3, 2]);
    expect(distance).toBe(2);
  });
});
