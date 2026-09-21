import { memo, useMemo } from 'react';
import { useSensorData } from '../context/SensorDataContext';

function formatCampusDate() {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

function formatSync(iso) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `il y a ${diff} s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function CampusHUD({ globalStats, formattedTime, offline }) {
  const { demo, stale, sensorDashboard } = useSensorData();
  const dateStr = useMemo(() => formatCampusDate(), []);
  const lastSync = formatSync(sensorDashboard?.last_sync);

  return (
    <aside
      className="absolute bottom-3 right-3 z-[400] hidden md:block bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-xl shadow-md px-4 py-3 text-xs space-y-1 max-w-[260px]"
      aria-label="Statistiques du campus"
    >
      {offline && (
        <span
          className="inline-block bg-amber-100 text-amber-900 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1"
          role="status"
        >
          📡 Mode Hors Ligne
        </span>
      )}
      {demo && (
        <span
          className="inline-block bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1"
          role="status"
        >
          🎮 Mode démo — courbe historique
        </span>
      )}
      {!demo && stale && (
        <span
          className="inline-block bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1"
          role="status"
        >
          ⏳ Données anciennes — synchronisation en cours
        </span>
      )}
      <p className="font-semibold text-slate-700 capitalize">
        🕐 {dateStr} — {formattedTime}
      </p>
      <p className="text-slate-500">🎓 Campus SUP&apos;PTIC — Yaoundé</p>
      <p className="text-slate-700">
        👥 Occupation globale : <strong>{globalStats.totalStudents}</strong> étudiants
      </p>
      <p className="text-slate-600">
        🔴 {globalStats.sature} saturées | 🟡 {globalStats.modere} modérées | 🟢{' '}
        {globalStats.disponible} disponibles
      </p>
      {lastSync && <p className="text-slate-400">🔄 Données mises à jour {lastSync}</p>}
      {(globalStats.knownBuildings ?? null) != null && (
        <p className="text-slate-400">
          🛰️ Couverture : {globalStats.knownBuildings}/{globalStats.totalRooms} bâtiments
        </p>
      )}
    </aside>
  );
}

export default memo(CampusHUD);
