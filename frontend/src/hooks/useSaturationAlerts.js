import { useEffect, useRef } from 'react';

const COOLDOWN_MS = 5 * 60 * 1000;
const ARM_DELAY_MS = 30 * 1000;

/**
 * Alertes de saturation ciblées (Phase 2) — favoris + bâtiments de l'itinéraire.
 * Armé 30 s après le montage (pas d'alerte sur un état préexistant),
 * cooldown de 5 min par bâtiment. Données démo/sans lecture ignorées.
 */
export function useSaturationAlerts({ occupancy, watchIds, enabled = true, onAlert }) {
  const lastAlert = useRef({});
  const armedAt = useRef(Date.now() + ARM_DELAY_MS);
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  useEffect(() => {
    if (!enabled || !watchIds?.length) return;
    const now = Date.now();
    if (now < armedAt.current) return;
    for (const rawId of watchIds) {
      const key = String(rawId);
      const o = occupancy[rawId] ?? occupancy[key];
      if (!o || o.count == null || o.simulated || o.unknown) continue;
      if ((o.taux ?? 0) > 0.9 && now - (lastAlert.current[key] ?? 0) > COOLDOWN_MS) {
        lastAlert.current[key] = now;
        onAlertRef.current?.(rawId, o);
      }
    }
  }, [occupancy, watchIds, enabled]);
}