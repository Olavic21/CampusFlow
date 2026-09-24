/**
 * Phase 1 — Orchestrateur central de démarrage.
 *
 * Séquence garantie :
 *   APPLICATION START → GET /health (retry/backoff) → backend READY
 *     → (consommateurs) chargement des données → WebSocket → APPLICATION READY
 *
 * États : checking → starting → online
 *                          ↘ offline (épuisement des tentatives ou erreur fatale)
 *         reconnecting : perte de l'état online puis nouvelles tentatives
 *
 * Gère aussi les événements online/offline du navigateur :
 *   offline → arrêt des retries (pas d'agression réseau)
 *   online  → relance propre d'un health check
 *
 * Aucun setInterval de maintenance : le backend n'est réveillé que par une
 * vraie utilisation de l'application (démarrage, retry manuel, retour online).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BackendReadyContext from './BackendReadyContext';
import { probeHealth, nextBackoffDelay, MAX_HEALTH_ATTEMPTS } from '../services/backendHealth';

function initialOnline() {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function BackendReadyProvider({ children }) {
  const [status, setStatus] = useState('checking'); // checking | starting | reconnecting | online | offline
  const [ready, setReady] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(initialOnline);

  const runIdRef = useRef(0); // annule la boucle en cours à chaque relance
  const sleepResolveRef = useRef(null); // résout le sleep en cours pour annulation
  const wasOnlineRef = useRef(false);
  const waitersRef = useRef(new Set()); // abonnés de waitForReady()

  // Miroirs des états pour que waitForReady() ait une identité stable
  // et lise toujours les valeurs fraîches (sans closure périmée).
  const statusRef = useRef(status);
  const readyRef = useRef(ready);
  useEffect(() => {
    statusRef.current = status;
    readyRef.current = ready;
  }, [status, ready]);

  const cancelRun = useCallback(() => {
    runIdRef.current += 1;
    if (sleepResolveRef.current) {
      sleepResolveRef.current();
      sleepResolveRef.current = null;
    }
  }, []);

  const resolveWaiters = useCallback((value) => {
    const waiters = waitersRef.current;
    waitersRef.current = new Set();
    waiters.forEach((w) => w(value));
  }, []);

  const sleep = useCallback(
    (ms) =>
      new Promise((resolve) => {
        const finish = () => {
          sleepResolveRef.current = null;
          resolve();
        };
        sleepResolveRef.current = finish;
        setTimeout(finish, ms);
      }),
    [],
  );

  const runProbeLoop = useCallback(async () => {
    cancelRun();
    const runId = runIdRef.current;

    if (!initialOnline()) {
      setReady(false);
      setStatus('offline');
      resolveWaiters(false);
      return; // pas de retry agressif hors ligne — relance via l'événement `online`
    }

    setReady(false);
    setStatus(wasOnlineRef.current ? 'reconnecting' : 'checking');

    for (let attempt = 0; attempt < MAX_HEALTH_ATTEMPTS; attempt++) {
      if (runId !== runIdRef.current) return; // relancé ou démonté

      if (attempt > 0) {
        setStatus(wasOnlineRef.current ? 'reconnecting' : 'starting');
      }

      const result = await probeHealth();
      if (runId !== runIdRef.current) return;

      if (result.ok) {
        wasOnlineRef.current = true;
        setReady(true);
        setStatus('online');
        resolveWaiters(true);
        return;
      }

      if (!result.retryable) {
        // Le backend répond mais /health échoue (4xx métier) : pas un cold start.
        setReady(false);
        setStatus('offline');
        resolveWaiters(false);
        return;
      }

      const failures = attempt + 1;
      if (failures >= MAX_HEALTH_ATTEMPTS) {
        setReady(false);
        setStatus('offline');
        resolveWaiters(false);
        return;
      }

      await sleep(nextBackoffDelay(failures));
      if (runId !== runIdRef.current) return;
    }
  }, [cancelRun, resolveWaiters, sleep]);

  // Démarrage + événements online/offline
  useEffect(() => {
    // Démarrage différé (1 tick) : le corps d'effet ne déclenche aucun setState
    // synchrone — la boucle de probes démarre juste après le commit.
    const startTimer = setTimeout(() => {
      runProbeLoop();
    }, 0);

    const handleOffline = () => {
      setBrowserOnline(false);
      cancelRun();
      setReady(false);
      setStatus('offline');
      resolveWaiters(false);
    };
    const handleOnline = () => {
      setBrowserOnline(true);
      runProbeLoop();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      clearTimeout(startTimer);
      cancelRun();
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      resolveWaiters(false);
    };
  }, [runProbeLoop, cancelRun, resolveWaiters]);

  /** Retry explicite (bouton de l'indicateur de connexion, retour de l'utilisateur). */
  const retry = useCallback(() => {
    runProbeLoop();
  }, [runProbeLoop]);

  /**
   * Résout true dès que le backend est READY,
   * false si la boucle se termine sans succès (épuisement / erreur fatale / offline).
   * Identité stable — lecture via refs pour éviter toute closure périmée.
   */
  const waitForReady = useCallback(() => {
    if (readyRef.current) return Promise.resolve(true);
    if (statusRef.current === 'offline') return Promise.resolve(false);
    return new Promise((resolve) => {
      waitersRef.current.add(resolve);
    });
  }, []);

  const settled = ready || status === 'offline';

  const value = useMemo(
    () => ({
      status,
      ready,
      settled,
      browserOnline,
      retry,
      waitForReady,
    }),
    [status, ready, settled, browserOnline, retry, waitForReady],
  );

  return (
    <BackendReadyContext.Provider value={value}>{children}</BackendReadyContext.Provider>
  );
}

