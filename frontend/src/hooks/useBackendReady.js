import { useContext } from 'react';
import BackendReadyContext from '../context/BackendReadyContext.js';

/** État d'initialisation backend : { status, ready, settled, browserOnline, retry, waitForReady }. */
export function useBackendReady() {
  const ctx = useContext(BackendReadyContext);
  if (!ctx) throw new Error('useBackendReady must be used within BackendReadyProvider');
  return ctx;
}
