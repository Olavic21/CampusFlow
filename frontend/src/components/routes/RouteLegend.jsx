import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

function RouteLegend({ routes, activeRouteId, onSelectRoute, onRemoveRoute, visible }) {
  if (!visible || !routes.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-24 md:bottom-8 left-3 right-3 md:left-auto md:right-3 md:max-w-xs z-[410] cf-glass rounded-2xl p-3 shadow-xl border border-white/30 dark:border-slate-600/50 pointer-events-auto"
      role="region"
      aria-label="Légende des itinéraires"
    >
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
        Itinéraires actifs
      </p>
      <ul className="space-y-2">
        <AnimatePresence>
          {routes.map((route) => (
            <motion.li
              key={route.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className={`flex items-center gap-2 rounded-xl px-2 py-1.5 cursor-pointer transition-all duration-[250ms]
                ${activeRouteId === route.id ? 'bg-slate-100 dark:bg-slate-800 ring-2 ring-[#2563EB]/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              onClick={() => onSelectRoute?.(route.id)}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white dark:ring-slate-900"
                style={{ backgroundColor: route.color }}
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex-1 truncate">
                {route.label}
              </span>
              {routes.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRoute?.(route.id);
                  }}
                  className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600"
                  aria-label="Retirer cet itinéraire"
                >
                  <X size={14} />
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
}

export default memo(RouteLegend);
