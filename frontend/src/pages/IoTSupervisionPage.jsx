import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Building2,
  Cpu,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useSensorData } from '../context/SensorDataContext';
import { fetchSensors, injectTestReading } from '../services/sensorApi';
import { SkeletonList } from '../components/ui/Skeleton';
import { buildIoTCampusCatalog, summarizeIoTCampus } from '../utils/iotCampusCatalog';

function formatLastSeen(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `Il y a ${diff} s`;
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  return new Date(iso).toLocaleString('fr-FR');
}

function statusIcon(status) {
  if (status === 'online') return '🟢';
  if (status === 'error') return '🔴';
  if (status === 'simulation') return '🟡';
  return '⚪';
}

function sourceLabel(source) {
  const map = {
    simulation: 'Simulation',
    digital_twin: 'Digital Twin',
    api: 'API',
    mqtt: 'MQTT',
    websocket: 'WebSocket',
    counter: 'Compteur',
    flux: 'Flux live',
  };
  return map[source] || source || '—';
}

function congestionBadge(taux) {
  if (taux > 0.9) return { label: 'Saturé', cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' };
  if (taux > 0.4) return { label: 'Modéré', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' };
  return { label: 'Disponible', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' };
}

export default function IoTSupervisionPage({ onToast }) {
  const { sensorMode, sensorDashboard, refreshMeta, buildings, occupancy } = useSensorData();
  const [apiSensors, setApiSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchSensors();
      setApiSensors(list);
      await refreshMeta();
    } catch {
      onToast?.('error', 'Impossible de charger les capteurs');
    } finally {
      setLoading(false);
    }
  }, [refreshMeta, onToast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const catalog = useMemo(
    () => buildIoTCampusCatalog(apiSensors, buildings, occupancy),
    [apiSensors, buildings, occupancy],
  );

  const summary = useMemo(() => summarizeIoTCampus(catalog), [catalog]);

  const categories = useMemo(() => {
    const set = new Set(catalog.map((e) => e.categoryLabel).filter(Boolean));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))];
  }, [catalog]);

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return catalog;
    return catalog.filter((e) => e.categoryLabel === categoryFilter);
  }, [catalog, categoryFilter]);

  const handleTestInject = async () => {
    const physical = catalog.find((e) => e.hasPhysicalSensor && e.id);
    if (!physical) {
      onToast?.('info', 'Aucun capteur physique API — lancez le backend seedé');
      return;
    }
    try {
      await injectTestReading({
        building_id: physical.location_id,
        sensor_id: physical.id,
        occupancy: Math.min(physical.capacite || 25, Math.floor(Math.random() * 30) + 5),
        confidence_score: 0.95,
      });
      onToast?.('success', `Lecture test injectée — ${physical.code || physical.building}`);
      load();
    } catch (err) {
      onToast?.('error', err.message || 'Erreur injection');
    }
  };

  if (loading && !catalog.length) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <SkeletonList count={6} />
      </div>
    );
  }

  const dash = sensorDashboard || {};

  return (
    <div className="flex-1 overflow-y-auto sidebar-scroll p-4 md:p-8 max-w-5xl mx-auto w-full">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={22} className="text-[#2563EB]" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Centre de supervision IoT
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Campus SUP&apos;PTIC Digital Twin — {summary.totalBuildings} espaces suivis
            ({summary.physicalSensors} capteurs physiques, {summary.virtualSensors} points twin simulés).
          </p>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="cf-menu-card p-4">
            <p className="cf-menu-label flex items-center gap-1">
              <Building2 size={12} />
              Campus
            </p>
            <p className="text-2xl font-bold text-[#2563EB]">{summary.totalBuildings}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">bâtiments &amp; dortoirs</p>
          </div>
          <div className="cf-menu-card p-4">
            <p className="cf-menu-label">Capteurs actifs</p>
            <p className="text-2xl font-bold text-[#2563EB]">
              {dash.active_sensors ?? summary.onlineSensors}
              <span className="text-sm text-slate-400 font-normal">
                /{dash.total_sensors ?? summary.physicalSensors}
              </span>
            </p>
          </div>
          <div className="cf-menu-card p-4">
            <p className="cf-menu-label">Twin simulé</p>
            <p className="text-2xl font-bold text-amber-600">{summary.virtualSensors}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">dortoirs &amp; services</p>
          </div>
          <div className="cf-menu-card p-4">
            <p className="cf-menu-label">Lectures reçues</p>
            <p className="text-2xl font-bold">{dash.readings_received ?? 0}</p>
          </div>
          <div className="cf-menu-card p-4 col-span-2 md:col-span-1">
            <p className="cf-menu-label">Mode actuel</p>
            <p className="text-sm font-semibold mt-1 flex items-center gap-1">
              {sensorMode?.is_real ? '🟢' : '🟡'}
              {sensorMode?.label || dash.label || 'Simulation'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Sync : {formatLastSeen(dash.last_sync)}
            </p>
          </div>
        </section>

        {Object.keys(summary.categories).length > 0 && (
          <section className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  categoryFilter === cat
                    ? 'bg-[#2563EB] text-white'
                    : 'cf-stat-chip text-slate-600 dark:text-slate-300'
                }`}
              >
                {cat === 'all' ? 'Tous' : cat}
                {cat !== 'all' && (
                  <span className="ml-1 opacity-70">({summary.categories[cat]})</span>
                )}
              </button>
            ))}
          </section>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <button type="button" onClick={load} className="cf-btn-secondary text-sm flex items-center gap-2">
            <RefreshCw size={14} />
            Actualiser
          </button>
          <button type="button" onClick={handleTestInject} className="cf-btn-primary text-sm flex items-center gap-2">
            <Activity size={14} />
            Injecter lecture test
          </button>
        </div>

        <section className="cf-menu-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 dark:border-slate-700/50 text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Espace</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 font-medium">Occupation</th>
                  <th className="px-4 py-3 font-medium">Capteur</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const cong = congestionBadge(s.taux ?? 0);
                  return (
                    <tr
                      key={s.key}
                      className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-bold text-[#2563EB]">
                        {s.code || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium">{s.building}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{s.categoryLabel || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cong.cls}`}>
                          {Math.round((s.taux ?? 0) * 100)}% · {cong.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {s.hasPhysicalSensor ? s.name : 'Simulation locale'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs">
                          {statusIcon(s.status)}
                          {s.status === 'online'
                            ? 'En ligne'
                            : s.status === 'simulation'
                              ? 'Twin'
                              : s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="cf-stat-chip px-2 py-0.5 text-xs inline-flex items-center gap-1">
                          {s.source === 'mqtt' ? <Radio size={10} /> : <Wifi size={10} />}
                          {sourceLabel(s.source)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      <WifiOff size={24} className="mx-auto mb-2 opacity-50" />
                      Aucun espace dans cette catégorie
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
