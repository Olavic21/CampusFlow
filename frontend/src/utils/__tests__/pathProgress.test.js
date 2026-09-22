import { describe, it, expect } from 'vitest';
import campus from '../../data/campus.json';
import { buildCampusPedestrianGraph, toGraphKey } from '../campusPedestrianGraph';
import { dijkstra } from '../dijkstra';
import { buildResultFromPath } from '../pathResult';
import { findNodeIndexForBuilding, slicePathToStep } from '../pathProgress';
import CampusLayoutEngine from '../../engine/CampusLayoutEngine';

describe('pathProgress', () => {
  it('finds node index for buildings on path', () => {
    const { graph, nodes } = buildCampusPedestrianGraph(campus);
    const end = toGraphKey(6);
    const { path: nodePath } = dijkstra(graph, toGraphKey(1), end);
    const result = buildResultFromPath(nodePath, { nodes, geoBuildings: campus, occupancy: {} }, 100);
    const endBuilding = CampusLayoutEngine.getGpsBuildings({}, campus).find((b) => b.geoId === 6);
    const idx = findNodeIndexForBuilding(result.nodePath, nodes, endBuilding);
    expect(idx).toBeGreaterThan(0);
    expect(idx).toBe(result.nodePath.length - 1);
  });

  it('slices coords to current navigation step', () => {
    const { graph, nodes } = buildCampusPedestrianGraph(campus);
    const { path: nodePath } = dijkstra(graph, toGraphKey(14), toGraphKey('dortoir-3'));
    const result = buildResultFromPath(nodePath, { nodes, geoBuildings: campus, occupancy: {} }, 500);
    const midBuilding = result.segments[0]?.to;
    const { coords, planCoords } = slicePathToStep(result, midBuilding, nodes);
    expect(coords.length).toBeGreaterThan(1);
    expect(coords.length).toBeLessThanOrEqual(result.coords.length);
    expect(planCoords.length).toBe(coords.length);
  });
});
