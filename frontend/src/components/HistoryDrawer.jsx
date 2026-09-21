import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { X, WifiOff, RefreshCw } from 'lucide-react';
import BottomSheet from './ui/BottomSheet';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useModalA11y } from '../hooks/useModalA11y';
import { fetchFluxHistory } from '../services/api';

/**
 * Historique 4 semaines — alimenté par l'API /flux/history (données réelles
 * du backend). Le CSV statique embarqué a été retiré du bundle (P0-4) :
 * hors ligne, un état explicite est affiché au lieu de fausses données.
 */

function buildDailyChart(rows) {
  const byDay = {};
  for (const row of rows) {
    const day = String(row.timestamp).slice(0, 10);
    if (!byDay[day]) byDay[day] = { sum: 0, count: 0 };
    byDay[day].sum += row.nombre_etudiants;
    byDay[day].count += 1;
  }
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date: date.slice(5),
      avg: Math.round(sum / count),
    }));
}

function buildWeeklyHeatmap(rows) {
  const grid = Array.from({ length: 5 }, () => Array(12).fill(0));
  const counts = Array.from({ length: 5 }, () => Array(12).fill(0));
  for (const row of rows) {
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

function HistoryContent({ rows, building, loading, offline, onRetry }) {
  const chartData = useMemo(() => buildDailyChart(rows), [rows]);
  const heatmap = useMemo(() => buildWeeklyHeatmap(rows), [rows]);
  const maxHeat = useMemo(() => Math.max(...heatmap.flat(), 1), [heatmap]);

  const stats = useMemo(() => {
    if (!rows.length) return { avg: 0, max: 0, min: 0, peakHour: '—' };
    const vals = rows.map((r) => r.nombre_etudiants);
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const byHour = {};
    for (const r of rows) {
      byHour[r.heure_du_jour] = (byHour[r.heure_du_jour] || 0) + r.nombre_etudiants;
    }
    const peakHour = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
    return {
      avg,
      max,
      min,
      peakHour: peakHour ? `${String(peakHour[0]).padStart(2, '0')}h00` : '—',
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-slate-400 gap-2">
        <RefreshCw size={22} className="animate-spin" />
        <p className="text-sm">Chargement de l&apos;historique…</p>
      </div>
    );
  }

  if (offline) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-slate-400 gap-2 text-center">
        <WifiOff size={22} />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Historique indisponible hors ligne
        </p>
        <p className="text-xs">
          Les données réelles des 4 semaines sont servies par le serveur.
          Reconnectez-vous pour les consulter.
        </p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="cf-btn-secondary mt-2 text-xs">
            Réessayer
          </button>
        )}
      </div>
    );
  }

  return <HistoryCharts rows={rows} building={building} chartData={chartData} heatmap={heatmap} maxHeat={maxHeat} stats={stats} />;
}

function HistoryCharts({ rows, building, chartData, heatmap, maxHeat, stats }) {
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  const hours = Array.from({ length: 12 }, (_, i) => i + 7);

  return (
    <div className="p-4 md:p-5 space-y-6 pb-safe">
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
          Historique 4 semaines — {building?.nom}
        </p>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={24} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 12 }}
                formatter={(value) => [`${value} étudiants`, 'Moyenne']}
              />
              <Line type="monotone" dataKey="avg" stroke="#2563EB" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
          Heatmap hebdomadaire (7h – 19h)
        </p>
        <div className="space-y-1">
          {days.map((day, di) => (
            <div key={day} className="flex items-center gap-1">
              <div className="w-8 text-[10px] text-slate-500 flex items-center">{day}</div>
              {hours.map((_, hi) => (
                <div
                  key={`${di}-${hi}`}
                  className="w-5 h-5 rounded-sm"
                  style={{ backgroundColor: heatColor(heatmap[di][hi], maxHeat) }}
                  title={`${Math.round(heatmap[di][hi])} étudiants`}
                />
              ))}
            </div>
          ))}
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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!building) return undefined;
    let cancelled = false;
    setLoading(true);
    setOffline(false);
    setRows([]);
    (async () => {
      try {
        const resp = await fetchFluxHistory(building.geoId ?? building.id, 'hour');
        if (cancelled) return;
        const data = (resp?.data ?? []).map((d) => {
          const ts = new Date(d.timestamp);
          return {
            timestamp: d.timestamp,
            nombre_etudiants: d.avg_students,
            heure_du_jour: ts.getHours(),
            jour_semaine: (ts.getDay() + 6) % 7, // 0 = Lundi
          };
        });
        setRows(data);
      } catch {
        if (!cancelled) setOffline(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [building, retryToken]);

  const retry = () => setRetryToken((t) => t + 1);
  const contentProps = { rows, building, loading, offline, onRetry: retry };

  // A11y (desktop) : piège de focus + Escape (audit P1)
  const modalRef = useModalA11y({ open: !!building && !isMobile, onClose });

  if (isMobile) {
    return (
      <BottomSheet
        open={!!building}
        onClose={onClose}
        title={building?.nom}
        initialSnap={0.9}
      >
        {building && <HistoryContent {...contentProps} />}
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
            ref={modalRef}
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
              <HistoryContent {...contentProps} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
