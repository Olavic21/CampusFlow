import { describe, it, expect } from 'vitest';
import {
  probeHealth,
  nextBackoffDelay,
  healthUrl,
  BACKOFF_DELAYS_MS,
  BACKOFF_CAP_MS,
  MAX_HEALTH_ATTEMPTS,
  JITTER_RATIO,
} from '../backendHealth';

const noJitter = () => 0.5; // rand=0.5 → jitter nul

describe('healthUrl', () => {
  it('pointe sur /health (base VITE_API_URL ou proxy dev)', () => {
    expect(healthUrl().endsWith('/health')).toBe(true);
    expect(healthUrl()).not.toMatch(/^ws/);
  });
});

describe('backoff cold start', () => {
  it('respecte la séquence 2s, 5s, 10s, 20s, 30s puis plafond 30s', () => {
    expect(BACKOFF_DELAYS_MS).toEqual([2000, 5000, 10000, 20000, 30000]);
    expect(nextBackoffDelay(1, noJitter)).toBe(2000);
    expect(nextBackoffDelay(2, noJitter)).toBe(5000);
    expect(nextBackoffDelay(3, noJitter)).toBe(10000);
    expect(nextBackoffDelay(4, noJitter)).toBe(20000);
    expect(nextBackoffDelay(5, noJitter)).toBe(30000);
    expect(nextBackoffDelay(6, noJitter)).toBe(30000); // plafond
    expect(nextBackoffDelay(99, noJitter)).toBe(30000); // jamais au-delà du plafond
  });

  it('reste borné par le jitter ±20 % et le plancher de 500 ms', () => {
    for (let failures = 1; failures <= 10; failures++) {
      const base = BACKOFF_DELAYS_MS[Math.min(failures, BACKOFF_DELAYS_MS.length) - 1];
      const min = nextBackoffDelay(failures, () => 0);
      const max = nextBackoffDelay(failures, () => 1);
      expect(min).toBeGreaterThanOrEqual(Math.max(500, Math.round(base * (1 - JITTER_RATIO)) - 1));
      expect(max).toBeLessThanOrEqual(Math.round(base * (1 + JITTER_RATIO)) + 1);
      expect(max).toBeLessThanOrEqual(BACKOFF_CAP_MS);
      expect(min).toBeLessThanOrEqual(max);
    }
  });

  it('couvre la séquence complète avec le nombre de tentatives', () => {
    expect(MAX_HEALTH_ATTEMPTS).toBeGreaterThanOrEqual(BACKOFF_DELAYS_MS.length + 1);
  });
});

describe('probeHealth — sémantique des erreurs', () => {
  const res = (status) => ({ ok: status >= 200 && status < 300, status });

  it('HTTP 200 → ok', async () => {
    const r = await probeHealth({ fetchImpl: async () => res(200) });
    expect(r).toEqual({ ok: true });
  });

  it('503/502/504 → retryable (cold start Render)', async () => {
    for (const status of [502, 503, 504]) {
      const r = await probeHealth({ fetchImpl: async () => res(status) });
      expect(r.ok).toBe(false);
      expect(r.retryable).toBe(true);
      expect(r.status).toBe(status);
    }
  });

  it('408/429 → retryable (temporel)', async () => {
    for (const status of [408, 429]) {
      const r = await probeHealth({ fetchImpl: async () => res(status) });
      expect(r.retryable).toBe(true);
    }
  });

  it('401/403/404/422 → NON retryable (le serveur répond : pas un cold start)', async () => {
    for (const status of [401, 403, 404, 422]) {
      const r = await probeHealth({ fetchImpl: async () => res(status) });
      expect(r.ok).toBe(false);
      expect(r.retryable).toBe(false);
      expect(r.status).toBe(status);
    }
  });

  it('erreur réseau (TypeError Failed to fetch) → retryable', async () => {
    const r = await probeHealth({
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
    expect(r.status).toBeNull();
  });

  it('timeout → retryable (AbortError)', async () => {
    const r = await probeHealth({
      timeoutMs: 25,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
    });
    expect(r.ok).toBe(false);
    expect(r.retryable).toBe(true);
  });
});
