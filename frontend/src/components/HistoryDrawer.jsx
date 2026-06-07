import { Fragment, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { X } from 'lucide-react';
import frequentationRaw from '../data/frequentation.csv?raw';
import BottomSheet from './ui/BottomSheet';
import { useMediaQuery } from '../hooks/useMediaQuery';

function parseCSV(raw) {
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = vals[i]?.trim(); });
    obj.location_id = Number(obj.location_id);
    obj.nombre_etudiants = Number(obj.nombre_etudiants);
    obj.heure_du_jour = Number(obj.heure_du_jour);
    obj.jour_semaine = Number(obj.jour_semaine);
    return obj;
  });
}

function buildWeeklyHeatmap(data) {
  const grid = Array.from({ length: 5 }, () => Array(12).fill(0));
  const counts = Array.from({ length: 5 }, () => Array(12).fill(0));

  for (const row of data) {
    const day = row.jour_semaine;
    const hourIdx = row.heure_du_jour - 7;
    if (day >= 0 && day < 5 && hourIdx >= 0 && hourIdx < 12) {
      grid[day][hourIdx] += row.nombre_etudiants;
      counts[day][hourIdx]++;
    }
  }

  return grid.map((row, d) =>
    row.map((sum, h) => (counts[d][h] ? sum / counts[d][h] : 0)),
  );
}

function heatColor(val, max) {
  const t = max > 0 ? val / max : 0;
  const r = Math.round(34 + t * (239 - 34));
  const g = Math.round(197 - t * (197 - 68));
  const b = Math.round(94 - t * (94 - 68));
  return `rgb(${r},${g},${b})`;
}

function HistoryContent({ buildingData, building }) {
  const chartData = useMemo(() => {
    const byDay = {};
    for (const row of buildingData) {
      const day = row.timestamp.split(' ')[0];
      if (!byDay[day]) byDay[day] = { sum: 0, count: 0 };
      byDay[day].sum += row.nombre_etudiants;
      byDay[day].count++;
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, count }]) => ({
        date: date.slice(5),
        avg: Math.round(sum / count),
      }));
  }, [buildingData]);

  const heatmap = useMemo(() => buildWeeklyHeatmap(buildingData), [buildingData]);
  const maxHeat = useMemo(() => Math.max(...heatmap.flat(), 1), [heatmap]);

  const stats = useMemo(() => {
    if (!buildingData.length) return { avg: 0, max: 0, min: 0, peakHour: '—' };
    const vals = buildingData.map((r) => r.nombre_etudiants);
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const byHour = {};
    for (const r of buildingData) {
      byHour[r.heure_du_jour] = (byHour[r.heure_du_jour] || 0) + r.nombre_etudiants;
    }
    const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    return {
      avg,
      max,
      min,
      peakHour: peakHour ? `${String(peakHour[0]).padStart(2, '0')}h00` : '—',
    };
  }, [buildingData]);

  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  const hours = Array.from({ length: 12 }, (_, i) => i + 7);

  return (
    <div className="p-4 md:p-5 space-y-6 pb-safe">
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
          Historique 4 semaines — {building?.nom}
        </p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="avg" stroke="#0088fe" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Heatmap hebdomadaire</p>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `40px repeat(${hours.length}, 1fr)` }}>
            <div />
            {hours.map((h) => (
              <div key={h} className="text-[9px] text-center text-slate-400">{h}h</div>
            ))}
            {days.map((day, di) => (
              <Fragment key={day}>
                <div className="text-[10px] text-slate-500 flex items-center">{day}</div>
                {hours.map((_, hi) => (
                  <div
                    key={`${di}-${hi}`}
                    className="w-5 h-5 rounded-sm"
                    style={{ backgroundColor: heatColor(heatmap[di][hi], maxHeat) }}
                    title={`${Math.round(heatmap[di][hi])} étudiants`}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="cf-stat-chip p-3">
          <p className="text-xs text-slate-500">Moyenne</p>
          <p className="font-bold text-slate-800 dark:text-white">{stats.avg}</p>
        </div>
        <div className="cf-stat-chip p-3">
          <p className="text-xs text-slate-500">Max</p>
          <p className="font-bold text-slate-800 dark:text-white">{stats.max}</p>
        </div>
        <div className="cf-stat-chip p-3">
          <p className="text-xs text-slate-500">Min</p>
          <p className="font-bold text-slate-800 dark:text-white">{stats.min}</p>
        </div>
        <div className="cf-stat-chip p-3">
          <p className="text-xs text-slate-500">Heure de pic</p>
          <p className="font-bold text-slate-800 dark:text-white">{stats.peakHour}</p>
        </div>
      </div>
    </div>
  );
}

export default function HistoryDrawer({ building, onClose }) {
  const isMobile = !useMediaQuery('(min-width: 768px)');
  const allData = useMemo(() => parseCSV(frequentationRaw), []);

  const buildingData = useMemo(
    () => (building ? allData.filter((r) => r.location_id === building.id) : []),
    [allData, building],
  );

  if (isMobile) {
    return (
      <BottomSheet
        open={!!building}
        onClose={onClose}
        title={building?.nom}
        initialSnap={0.9}
      >
        {building && <HistoryContent buildingData={buildingData} building={building} />}
      </BottomSheet>
    );
  }

  return (
    <AnimatePresence>
      {building && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-[550]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-[560] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-slate-800 dark:text-white">{building.nom}</h2>
              <button
                type="button"
                onClick={onClose}
                className="cf-touch-target p-2 text-slate-400 hover:text-slate-600"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto sidebar-scroll">
              <HistoryContent buildingData={buildingData} building={building} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
