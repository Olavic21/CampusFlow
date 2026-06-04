import { memo } from 'react';
import { motion } from 'framer-motion';

function MapLoadingOverlay({ visible, label = 'Chargement du campus…' }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[480] flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm pointer-events-none"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4 bg-white/95 rounded-2xl px-8 py-6 shadow-xl">
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
      </div>
    </motion.div>
  );
}

export default memo(MapLoadingOverlay);
