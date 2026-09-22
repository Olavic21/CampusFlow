import { describe, it, expect } from 'vitest';
import { filterBuildings } from '../filterBuildings';

const buildings = [
  { id: 1, nom: 'Amphi A', type: 'amphi', capacite: 200 },
  { id: 2, nom: 'Labo B', type: 'labo', capacite: 40 },
  { id: 3, nom: 'Salle C', type: 'salle', capacite: 50 },
];

describe('filterBuildings', () => {
  const baseFilters = { types: ['amphi', 'labo', 'salle', 'admin'], congestion: 'all', heatmapOnly: false };

  it('filters by building type', () => {
    const filters = { ...baseFilters, types: ['labo'] };
    const result = filterBuildings(buildings, filters, {});
    expect(result.map((b) => b.id)).toEqual([2]);
  });

  it('filters saturated buildings only', () => {
    const occupancy = {
      1: { taux: 0.2, count: 40 },
      2: { taux: 0.95, count: 38 },
      3: { taux: 0.5, count: 25 },
    };
    const filters = { ...baseFilters, congestion: 'sature' };
    const result = filterBuildings(buildings, filters, occupancy);
    expect(result.map((b) => b.id)).toEqual([2]);
  });

  it('returns all when congestion filter is all', () => {
    const result = filterBuildings(buildings, baseFilters, { 1: { taux: 0.95 } });
    expect(result).toHaveLength(3);
  });
});
