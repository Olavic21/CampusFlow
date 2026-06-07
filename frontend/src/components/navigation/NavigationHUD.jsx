import { memo } from 'react';
import { motion } from 'framer-motion';
import { X, Clock, Ruler, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

function NavigationHUD({
  result,
  currentStepLabel,
  stepIndex = 0,
  stepCount = 0,
  onExit,
  onStepPrev,
  onStepNext,
}) {
  if (!result) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-[520] w-[calc(100%-1.5rem)] max-w-md pointer-events-auto"
    >
      <div className="cf-glass rounded-2xl shadow-2xl border border-white/40 dark:border-slate-600/50 p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-white text-xs font-bold">
              GO
            </span>
            <div>
              <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wide">
                Mode navigation
              </p>
              <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[200px]">
                {currentStepLabel || 'Itinéraire actif'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="cf-btn-ghost shrink-0 p-2 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
            aria-label="Quitter la navigation"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="cf-stat-chip flex items-center gap-2 p-3">
            <Ruler size={18} className="text-[#2563EB]" strokeWidth={2} />
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Distance</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {result.totalDistance} m
              </p>
            </div>
          </div>
          <div className="cf-stat-chip flex items-center gap-2 p-3">
            <Clock size={18} className="text-emerald-600" strokeWidth={2} />
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Temps estimé</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                ~{result.estimatedMinutes} min
              </p>
            </div>
          </div>
        </div>
        {currentStepLabel && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 flex items-center gap-1.5 min-w-0">
              <MapPin size={14} strokeWidth={2} className="shrink-0" />
              <span className="truncate">
                Étape {stepCount > 0 ? `${stepIndex + 1}/${stepCount}` : ''} :{' '}
                <strong className="text-slate-700 dark:text-slate-200">{currentStepLabel}</strong>
              </span>
            </p>
            {stepCount > 1 && (
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  disabled={stepIndex <= 0}
                  onClick={onStepPrev}
                  className="cf-btn-ghost p-1.5 rounded-lg disabled:opacity-30"
                  aria-label="Étape précédente"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  disabled={stepIndex >= stepCount - 1}
                  onClick={onStepNext}
                  className="cf-btn-ghost p-1.5 rounded-lg disabled:opacity-30"
                  aria-label="Étape suivante"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default memo(NavigationHUD);
