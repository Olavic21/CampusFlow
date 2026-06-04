import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  FlaskConical,
  Presentation,
  Building2,
  Info,
} from 'lucide-react';

const CONGESTION_LEVELS = [
  { color: '#22c55e', label: 'Disponibles', range: '0 à 40 %' },
  { color: '#f59e0b', label: 'Modérés', range: '40 à 70 %' },
  { color: '#ef4444', label: 'Chargés', range: '70 à 90 %' },
  { color: '#7c3aed', label: 'Saturés', range: '+90 %' },
];

const BUILDING_TYPES = [
  { Icon: GraduationCap, label: 'Amphithéâtre' },
  { Icon: FlaskConical, label: 'Laboratoire' },
  { Icon: Presentation, label: 'Salle de cours' },
  { Icon: Building2, label: 'Administration' },
];

function MapLegend({ visible = true, collapsed: initialCollapsed = false }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute bottom-24 md:bottom-8 left-3 z-[400] cf-glass rounded-2xl shadow-xl border border-white/30 dark:border-slate-600/40 p-4 text-xs max-w-[200px] pointer-events-auto"
      role="region"
      aria-label="Légende de la carte"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Info size={14} className="text-[#2563EB]" strokeWidth={2} />
        <p className="font-bold text-slate-800 dark:text-white">Légende</p>
      </div>

      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Congestion
      </p>
      <ul className="space-y-2 mb-4">
        {CONGESTION_LEVELS.map(({ color, label, range }) => (
          <li key={label} className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white dark:ring-slate-800 shadow-sm"
              style={{ backgroundColor: color }}
            />
            <div>
              <p className="font-medium text-slate-700 dark:text-slate-200">{label}</p>
              <p className="text-[10px] text-slate-500">{range}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Types de lieux
      </p>
      <ul className="space-y-1.5">
        {BUILDING_TYPES.map(({ Icon, label }) => (
          <li key={label} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Icon size={14} strokeWidth={2} className="text-slate-500 shrink-0" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export default memo(MapLegend);
