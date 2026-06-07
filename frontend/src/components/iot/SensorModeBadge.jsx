import { memo } from 'react';
import { useSensorData } from '../../context/SensorDataContext';

function SensorModeBadge({ compact }) {
  const { sensorMode } = useSensorData();
  const isReal = sensorMode?.is_real;
  const label = sensorMode?.label || (isReal ? 'Données Réelles' : 'Mode Simulation');

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-medium shadow-sm
        ${compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1'}
        ${isReal
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}
      role="status"
      aria-live="polite"
      title={sensorMode?.description || label}
    >
      <span aria-hidden="true">{isReal ? '🟢' : '🟡'}</span>
      <span>{label}</span>
    </div>
  );
}

export default memo(SensorModeBadge);
