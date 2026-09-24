import { memo, useEffect, useState } from 'react';
import { useBackendReady } from '../hooks/useBackendReady.js';

/**
 * Indicateur d'état global discret (haut d'écran), dark-mode et mobile friendly.
 * États : Connexion au serveur… / Serveur en démarrage… / Connecté /
 *         Reconnexion… / Hors ligne (appuyer pour réessayer)
 * N'occulte jamais l'application : pastille flottante non bloquante.
 */
const STATUS_TEXT = {
  checking: 'Connexion au serveur…',
  starting: 'Serveur en démarrage…',
  reconnecting: 'Reconnexion…',
  online: 'Connecté',
  offline: 'Hors ligne',
};

const STATUS_STYLE = {
  checking: 'bg-slate-800/90 text-slate-100 border-slate-600/60',
  starting: 'bg-amber-500/95 text-amber-950 border-amber-300/50',
  reconnecting: 'bg-amber-500/95 text-amber-950 border-amber-300/50',
  online: 'bg-emerald-600/95 text-white border-emerald-300/50',
  offline: 'bg-rose-600/95 text-white border-rose-300/50',
};

function ConnectionIndicator() {
  const { status, retry } = useBackendReady();
  const [visible, setVisible] = useState(status !== 'online');

  useEffect(() => {
    if (status === 'online') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3500);
      return () => clearTimeout(t);
    }
    setVisible(true);
    return undefined;
  }, [status]);

  if (!visible) return null;

  const canRetry = status === 'offline';
  const label = STATUS_TEXT[status] ?? STATUS_TEXT.checking;

  return (
    <div
      className="fixed top-safe left-1/2 -translate-x-1/2 z-[950] pointer-events-none px-3"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={canRetry ? retry : undefined}
        disabled={!canRetry}
        aria-label={canRetry ? `${label} — appuyer pour réessayer` : label}
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md transition-opacity
          ${STATUS_STYLE[status] ?? STATUS_STYLE.checking}
          ${canRetry ? 'cursor-pointer active:scale-95' : 'cursor-default'}
          dark:border-slate-500/40`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            status === 'online'
              ? 'bg-emerald-200'
              : status === 'offline'
                ? 'bg-rose-100'
                : 'bg-amber-100 animate-pulse'
          }`}
          aria-hidden="true"
        />
        <span>{label}</span>
        {canRetry && <span className="text-[10px] opacity-80">(toucher pour réessayer)</span>}
      </button>
    </div>
  );
}

export default memo(ConnectionIndicator);
