import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Percent,
  AlertTriangle,
  DoorOpen,
  Cpu,
  Radio,
  Activity,
  Building2,
  TrendingUp,
} from 'lucide-react';
import { getCongestionLevel } from '../utils/congestionColor';
import { getBuildingLucideIcon } from '../utils/buildingVisuals';
import { useSensorData } from '../context/SensorDataContext';
import CampusLayoutEngine from '../engine/CampusLayoutEngine';
import { safeOccupancy } from '../utils/buildingSafety';
import { summarizeIoTCampus, buildIoTCampusCatalog } from '../utils/iotCampusCatalog';

function KpiCard({ icon: Icon, label, value, sub, accent = 'blue' }) {
  const accents = {
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-200/60 text-blue-600',
    green: 'from-emerald-500/10 to-emerald-600/5 border-emerald-200/60 text-emerald-600',
    amber: 'from-amber-500/10 to-amber-600/5 border-amber-200/60 text-amber-600',
    violet: 'from-violet-500/10 to-violet-600/5 border-violet-200/60 text-violet-600',
  };
  return (
    <motion.div
      layout
      className={`cf-stat-chip p-4 bg-gradient-to-br border ${accents[accent]}`}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Icon size={22} className="mb-2 opacity-80" />
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </motion.div>
  );
}

function formatSync(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `Il y a ${diff} s`;
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  return new Date(iso).toLocaleString('fr-FR');
}

function StatsDashboard({ globalStats, occupancy, buildings }) {
  const { sensorMode, sensorDashboard } = useSensorData();
  const dash = sensorDashboard || {};

  const campusBuildings = useMemo(
    () => CampusLayoutEngine.getGpsBuildings(occupancy, buildings),
    [occupancy, buildings],
  );

  const iotSummary = useMemo(() => {
    const catalog = buildIoTCampusCatalog([], buildings, occupancy);
    return summarizeIoTCampus(catalog);
  }, [buildings, occupancy]);

  const topBusy = useMemo(
    () =>
      [...campusBuildings]
        .map((b) => {
          const occ = safeOccupancy(occupancy, b);
          return { b, taux: occ.taux, count: occ.count };
        })
        .sort((a, c) => c.taux - a.taux)
        .slice(0, 8),
    [campusBuildings, occupancy],
  );

  const byCategory = useMemo(() => {
    const map = {};
    for (const b of campusBuildings) {
      const cat = b.categoryLabel || b.category || 'Autre';
      const occ = safeOccupancy(occupancy, b);
      if (!map[cat]) map[cat] = { count: 0, total: 0, tauxSum: 0 };
      map[cat].count += 1;
      map[cat].total += occ.count;
      map[cat].tauxSum += occ.taux;
    }
    return Object.entries(map)
      .map(([label, data]) => ({
        label,
        buildings: data.count,
        students: data.total,
        avgTaux: data.count ? data.tauxSum / data.count : 0,
      }))
      .sort((a, b) => b.avgTaux - a.avgTaux);
  }, [campusBuildings, occupancy]);

  const pct = Math.round(globalStats.occupancyRate * 100);
  const maxOcc = globalStats.maxBuilding
    ? safeOccupancy(occupancy, globalStats.maxBuilding)
    : null;
  const minOcc = globalStats.minBuilding
    ? safeOccupancy(occupancy, globalStats.minBuilding)
    : null;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 sidebar-scroll bg-slate-50 dark:bg-slate-950">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Tableau de bord</h1>
        <p className="text-sm text-slate-500 mt-1">
          Campus SUP&apos;PTIC Digital Twin — {campusBuildings.length} espaces suivis
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <KpiCard
          icon={Building2}
          label="Espaces campus"
          value={campusBuildings.length}
          sub={`${iotSummary.physicalSensors} capteurs API`}
          accent="violet"
        />
        <KpiCard
          icon={Users}
          label="Occupation campus"
          value={globalStats.totalStudents}
          sub="étudiants présents"
          accent="blue"
        />
        <KpiCard icon={Percent} label="Taux global" value={`${pct}%`} accent="green" />
        <KpiCard
          icon={AlertTriangle}
          label="Bâtiments saturés"
          value={globalStats.sature}
          accent="amber"
        />
        <KpiCard
          icon={DoorOpen}
          label="Salles libres"
          value={globalStats.disponible}
          sub={`sur ${globalStats.totalRooms}`}
          accent="violet"
        />
      </div>

      {(maxOcc || minOcc) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {globalStats.maxBuilding && (
            <div className="cf-glass rounded-[20px] p-4">
              <p className="text-xs font-semibold text-red-500 uppercase mb-1">Plus chargé</p>
              <p className="font-bold text-slate-900 dark:text-white">
                {globalStats.maxBuilding.code || globalStats.maxBuilding.nom}
              </p>
              <p className="text-sm text-slate-500">{globalStats.maxBuilding.nom}</p>
              <p className="text-lg font-bold text-red-600 mt-1">
                {Math.round((maxOcc?.taux ?? 0) * 100)}%
              </p>
            </div>
          )}
          {globalStats.minBuilding && (
            <div className="cf-glass rounded-[20px] p-4">
              <p className="text-xs font-semibold text-emerald-600 uppercase mb-1">Plus libre</p>
              <p className="font-bold text-slate-900 dark:text-white">
                {globalStats.minBuilding.code || globalStats.minBuilding.nom}
              </p>
              <p className="text-sm text-slate-500">{globalStats.minBuilding.nom}</p>
              <p className="text-lg font-bold text-emerald-600 mt-1">
                {Math.round((minOcc?.taux ?? 0) * 100)}%
              </p>
            </div>
          )}
        </section>
      )}

      <section className="cf-glass rounded-[20px] p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Cpu size={16} className="text-[#2563EB]" />
          <p className="text-xs font-semibold text-slate-500 uppercase">Supervision IoT</p>
          <span className="ml-auto text-xs font-medium">
            {sensorMode?.is_real ? '🟢' : '🟡'} {sensorMode?.label || 'Mode Simulation'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="cf-stat-chip p-3">
            <Radio size={16} className="text-emerald-600 mb-1" />
            <p className="text-xs text-slate-500">Capteurs actifs</p>
            <p className="text-lg font-bold">
              {dash.active_sensors ?? iotSummary.onlineSensors}
              <span className="text-xs text-slate-400 font-normal">
                /{dash.total_sensors ?? iotSummary.physicalSensors}
              </span>
            </p>
          </div>
          <div className="cf-stat-chip p-3">
            <Activity size={16} className="text-blue-600 mb-1" />
            <p className="text-xs text-slate-500">Lectures reçues</p>
            <p className="text-lg font-bold">{dash.readings_received ?? 0}</p>
          </div>
          <div className="cf-stat-chip p-3">
            <p className="text-xs text-slate-500">Twin simulé</p>
            <p className="text-lg font-bold text-amber-600">{iotSummary.virtualSensors}</p>
          </div>
          <div className="cf-stat-chip p-3">
            <p className="text-xs text-slate-500">Dernière sync</p>
            <p className="text-sm font-semibold mt-1">{formatSync(dash.last_sync)}</p>
          </div>
        </div>
      </section>

      <section className="cf-glass rounded-[20px] p-4 mb-6">
        <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Occupation globale</p>
        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#2563EB] to-[#22C55E] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <div className="flex justify-between mt-3 text-xs text-slate-600 dark:text-slate-400 gap-2">
          <span className="text-emerald-600 font-medium">{globalStats.disponible} dispo.</span>
          <span className="text-amber-600 font-medium">{globalStats.modere} modérées</span>
          <span className="text-red-600 font-medium">{globalStats.sature} saturées</span>
        </div>
      </section>

      <section className="cf-glass rounded-[20px] p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-[#2563EB]" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Par catégorie
          </h2>
        </div>
        <div className="space-y-2">
          {byCategory.map((cat) => {
            const { color } = getCongestionLevel(cat.avgTaux);
            return (
              <div key={cat.label} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-slate-600 dark:text-slate-400 text-xs font-medium">
                  {cat.label}
                </span>
                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.round(cat.avgTaux * 100)}%`, backgroundColor: color }}
                  />
                </div>
                <span className="w-10 text-right font-bold text-xs" style={{ color }}>
                  {Math.round(cat.avgTaux * 100)}%
                </span>
                <span className="w-16 text-right text-xs text-slate-400">{cat.buildings} esp.</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
          Bâtiments les plus chargés
        </h2>
        <ul className="space-y-2">
          {topBusy.map(({ b, taux, count }, i) => {
            const { color, label } = getCongestionLevel(taux);
            const Icon = getBuildingLucideIcon(b);
            return (
              <li key={b.id} className="cf-stat-chip flex items-center gap-3 p-3">
                <span className="text-slate-400 font-mono text-xs w-4">{i + 1}</span>
                <div
                  className="p-2 rounded-lg shrink-0"
                  style={{ backgroundColor: `${color}22` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    <span className="text-[#2563EB] font-bold mr-1">{b.code}</span>
                    {b.nom}
                  </p>
                  <p className="text-xs text-slate-500">
                    {b.categoryLabel || b.category} · {count}/{b.capacite} · {label}
                  </p>
                </div>
                <span className="text-sm font-bold" style={{ color }}>
                  {Math.round(taux * 100)}%
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default memo(StatsDashboard);
