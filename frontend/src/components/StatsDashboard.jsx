import { memo } from 'react';
import { motion } from 'framer-motion';
import { Users, Percent, AlertTriangle, DoorOpen } from 'lucide-react';
import { getCongestionLevel } from '../utils/congestionColor';
import { getBuildingLucideIcon } from '../utils/buildingVisuals';

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

function StatsDashboard({ globalStats, occupancy, buildings }) {
  const pct = Math.round(globalStats.occupancyRate * 100);
  const topBusy = [...buildings]
    .map((b) => ({ b, taux: occupancy[b.id]?.taux ?? 0 }))
    .sort((a, c) => c.taux - a.taux)
    .slice(0, 5);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 sidebar-scroll bg-slate-50 dark:bg-slate-950">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Tableau de bord</h1>
        <p className="text-sm text-slate-500 mt-1">Vue temps réel du campus SUP&apos;PTIC</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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

      <section>
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
          Bâtiments les plus chargés
        </h2>
        <ul className="space-y-2">
          {topBusy.map(({ b, taux }, i) => {
            const { color, label } = getCongestionLevel(taux);
            const Icon = getBuildingLucideIcon(b);
            const occ = occupancy[b.id];
            return (
              <li
                key={b.id}
                className="cf-stat-chip flex items-center gap-3 p-3"
              >
                <span className="text-slate-400 font-mono text-xs w-4">{i + 1}</span>
                <div
                  className="p-2 rounded-lg shrink-0"
                  style={{ backgroundColor: `${color}22` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {b.nom}
                  </p>
                  <p className="text-xs text-slate-500">
                    {occ?.count ?? 0}/{b.capacite} · {label}
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
