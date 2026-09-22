import { memo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  FlaskConical,
  Presentation,
  Building2,
  Home,
  Dumbbell,
  UtensilsCrossed,
  ChevronUp,
  Layers,
} from 'lucide-react';

const CONGESTION_LEVELS = [
  { color: '#22c55e', label: 'Disponible', range: '< 40 %' },
  { color: '#f59e0b', label: 'Modéré', range: '40–70 %' },
  { color: '#ef4444', label: 'Chargé', range: '70–90 %' },
  { color: '#7c3aed', label: 'Saturé', range: '> 90 %' },
];

const CATEGORIES = [
  { Icon: Building2, label: 'Administration' },
  { Icon: Presentation, label: 'Enseignement' },
  { Icon: GraduationCap, label: 'Amphithéâtre' },
  { Icon: Home, label: 'Dortoir' },
  { Icon: Dumbbell, label: 'Sport' },
  { Icon: UtensilsCrossed, label: 'Services' },
];

function MapLegend({ visible = true, collapsed: initialCollapsed = false }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-24 md:bottom-6 left-3 z-[400] cf-legend pointer-events-auto max-w-[220px]"
      role="region"
      aria-label="Légende"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
          <Layers size={14} className="text-[#2563EB]" />
          Légende
        </span>
        <ChevronUp size={14} className={`text-slate-400 transition ${collapsed ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-3 overflow-hidden"
          >
            <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Occupation
            </p>
            <ul className="space-y-1.5 mb-3">
              {CONGESTION_LEVELS.map(({ color, label, range }) => (
                <li key={label} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white/80 dark:ring-slate-900"
                    style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200">{label}</p>
                    <p className="text-[9px] text-slate-500">{range}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Zones
            </p>
            <ul className="space-y-1">
              {CATEGORIES.map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <Icon size={12} className="text-slate-400 shrink-0" />
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(MapLegend);
