import { describe, it, expect } from 'vitest';
import campus from '../../data/campus.json';
import {
  buildCampusPedestrianGraph,
  toGraphKey,
  simplifyNodePath,
} from '../campusPedestrianGraph';
import { dijkstra } from '../dijkstra';
import { buildResultFromPath } from '../pathResult';
import CampusLayoutEngine from '../../engine/CampusLayoutEngine';

describe('campusPedestrianGraph', () => {
  it('includes dortoirs on GPS map', () => {
    const gps = CampusLayoutEngine.getGpsBuildings({}, campus);
    const dortoirs = gps.filter((b) => b.category === 'dortoir');
    expect(dortoirs.length).toBe(7);
    dortoirs.forEach((d) => {
      expect(d.latitude).toBeGreaterThan(3.868);
      expect(d.longitude).toBeGreaterThan(11.507);
    });
  });

  it('connects dortoirs in pedestrian graph', () => {
    const { graph, nodes } = buildCampusPedestrianGraph(campus);
    const dortoirKey = toGraphKey('dortoir-1');
    expect(nodes[dortoirKey]).toBeDefined();
    expect(nodes[dortoirKey].planX).toBeDefined();
    expect(graph[dortoirKey]?.length).toBeGreaterThan(0);

    const start = toGraphKey(14);
    const end = toGraphKey('dortoir-3');
    const { path, distance } = dijkstra(graph, start, end);
    expect(path.length).toBeGreaterThan(2);
    expect(distance).toBeLessThan(Infinity);
    expect(path[0]).toBe(start);
    expect(path[path.length - 1]).toBe(end);
  });

  it('simplifies colinear waypoint paths', () => {
    const { graph, nodes } = buildCampusPedestrianGraph(campus);
    const { path: raw } = dijkstra(graph, toGraphKey(1), toGraphKey(6));
    const simplified = simplifyNodePath(raw, nodes);
    expect(simplified.length).toBeLessThanOrEqual(raw.length);
    expect(simplified[0]).toBe(raw[0]);
    expect(simplified[simplified.length - 1]).toBe(raw[raw.length - 1]);
  });

  it('builds planCoords along walkways', () => {
    const { graph, nodes } = buildCampusPedestrianGraph(campus);
    const end = toGraphKey(6);
    const { path: nodePath, distance } = dijkstra(graph, toGraphKey(1), end);
    const result = buildResultFromPath(nodePath, { nodes, geoBuildings: campus, occupancy: {} }, distance);
    expect(result.planCoords.length).toBeGreaterThan(2);
    expect(result.coords.length).toBe(result.planCoords.length);
  });
});
