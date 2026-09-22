import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * GPS continu (Phase 2 — navigation réelle) — watchPosition web ou Capacitor
 * Geolocation. Activé uniquement quand `enabled` (batterie / confidentialité).
 */
export function useGeolocation({ enabled = false } = {}) {
  const [position, setPosition] = useState(null); // { lat, lng, accuracy }
  const [error, setError] = useState(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let nativeWatch = null;

    const handlePosition = (lat, lng, accuracy) => {
      if (cancelled) return;
      setError(null);
      setPosition({ lat, lng, accuracy });
    };

    const start = async () => {
      try {
        if (Capacitor.isNativePlatform?.()) {
          const { Geolocation } = await import('@capacitor/geolocation');
          const perm = await Geolocation.checkPermissions();
          if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
            const req = await Geolocation.requestPermissions();
            if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
              if (!cancelled) setError('Permission de localisation refusée');
              return;
            }
          }
          nativeWatch = await Geolocation.watchPosition(
            { enableHighAccuracy: true },
            (pos, err) => {
              if (cancelled) return;
              if (err || !pos) {
                setError(err?.message || 'Position indisponible');
                return;
              }
              handlePosition(
                pos.coords.latitude,
                pos.coords.longitude,
                pos.coords.accuracy,
              );
            },
          );
        } else if (navigator.geolocation) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) =>
              handlePosition(
                pos.coords.latitude,
                pos.coords.longitude,
                pos.coords.accuracy,
              ),
            (err) => {
              if (!cancelled) setError(err.message || 'Position indisponible');
            },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
          );
        } else if (!cancelled) {
          setError('Géolocalisation non supportée par ce navigateur');
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Erreur de géolocalisation');
      }
    };

    start();

    return () => {
      cancelled = true;
      if (nativeWatch != null) {
        import('@capacitor/geolocation')
          .then(({ Geolocation }) => Geolocation.clearWatch({ id: nativeWatch }))
          .catch(() => {});
        nativeWatch = null;
      }
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);

  return { position, error };
}