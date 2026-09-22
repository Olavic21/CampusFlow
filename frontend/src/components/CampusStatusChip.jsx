import { memo } from 'react';
import { useSensorData } from '../hooks/useSensorData';

/**
 * Chip compacte d'état du campus — visible sur mobile dans l'entête
 * (audit P1 : aucune synthèse d'état n'était visible sur mobile).
 * Priorité : hors ligne > démo > données anciennes > alerte saturation > fluide.
 */
function CampusStatusChip() {
  const { globalStats, offline, demo, stale, loading } = useSensorData();

  if (loading) return null;

  let icon = '🟢';
  let label = 'Campus fluide';
  let cls =
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300';

  if (offline) {
    icon = '📡';
    label = 'Hors ligne';
    cls =
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  } else if (demo) {
    icon = '🎮';
    label = 'Mode démo';
    cls =
      'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300';
  } else if (stale) {
    icon = '⏳';
    label = 'Données anciennes';
    cls =
      'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300';
  } else if ((globalStats?.sature ?? 0) > 0) {
    icon = '🟠';
    label = `${globalStats.sature} saturée${globalStats.sature > 1 ? 's' : ''}`;
    cls =
      'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300';
  }

  const pct = Math.round((globalStats?.occupancyRate ?? 0) * 100);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full text-[11px] font-semibold px-2 py-0.5 shrink-0 ${cls}`}
      role="status"
      aria-live="polite"
      title={`Occupation campus : ${pct}% · ${
        globalStats?.knownBuildings ?? 0
      }/${globalStats?.totalRooms ?? 0} bâtiments avec capteur`}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
      {!offline && !demo && !stale && (
        <span className="opacity-70">· {pct}%</span>
      )}
    </span>
  );
}

export default memo(CampusStatusChip);