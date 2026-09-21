import { memo } from 'react';
import { useSensorData } from '../../context/SensorDataContext';

function SensorModeBadge({ compact }) {
  const { sensorMode, demo, stale } = useSensorData();

  // Priorité d'affichage : démo > données anciennes > source backend
  const state = demo
    ? {
        isReal: false,
        label: 'Mode démo',
        cls: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
        icon: '🎮',
      }
    : stale
      ? {
          isReal: false,
          label: 'Données anciennes',
          cls: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
          icon: '⏳',
        }
      : {
          isReal: sensorMode?.is_real,
          label:
            sensorMode?.label || (sensorMode?.is_real ? 'Données Réelles' : 'Mode Simulation'),
          cls: sensorMode?.is_real
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
          icon: sensorMode?.is_real ? '🟢' : '🟡',
        };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-medium shadow-sm
        ${compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1'}
        ${state.cls}`}
      role="status"
      aria-live="polite"
      title={
        demo
          ? 'Mode démo — courbe historique, pas un état temps réel'
          : stale
            ? 'Aucune mise à jour récente — certaines données peuvent être obsolètes'
            : sensorMode?.description || state.label
      }
    >
      <span aria-hidden="true">{state.icon}</span>
      <span>{state.label}</span>
    </div>
  );
}

export default memo(SensorModeBadge);
