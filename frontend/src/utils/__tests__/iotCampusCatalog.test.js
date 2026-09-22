import { describe, it, expect } from 'vitest';
import campus from '../../data/campus.json';
import { buildIoTCampusCatalog, summarizeIoTCampus } from '../iotCampusCatalog';

describe('iotCampusCatalog', () => {
  it('includes dortoirs and API buildings', () => {
    const apiSensors = campus.slice(0, 3).map((b, i) => ({
      id: i + 1,
      name: `SIM-${b.id}`,
      location_id: b.id,
      building: b.nom,
      sensor_type: 'counter',
      status: 'online',
      source: 'simulation',
    }));
    const catalog = buildIoTCampusCatalog(apiSensors, campus, {});
    const dortoirs = catalog.filter((e) => e.category === 'dortoir');
    expect(catalog.length).toBeGreaterThan(campus.length);
    expect(dortoirs.length).toBe(7);
    expect(dortoirs.every((d) => !d.hasPhysicalSensor)).toBe(true);
  });

  it('summarizes physical vs virtual coverage', () => {
    const catalog = buildIoTCampusCatalog([], campus, {});
    const summary = summarizeIoTCampus(catalog);
    expect(summary.totalBuildings).toBeGreaterThan(0);
    expect(summary.virtualSensors).toBeGreaterThan(0);
  });
});
