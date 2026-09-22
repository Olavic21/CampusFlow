import { memo } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Circle } from 'lucide-react';

function NavigationGuide({ steps, activeStepIndex, onStepSelect, className = '' }) {
  if (!steps.length) return null;

  return (
    <div className={`flex flex-col ${className}`}>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1 mb-2">
        Guidage pas à pas
      </p>
      <ol className="space-y-0 overflow-y-auto sidebar-scroll flex-1 max-h-64 md:max-h-none">
        {steps.map((step, i) => {
          const isActive = i === activeStepIndex;
          const isPast = i < activeStepIndex;
          const showArrow = i < steps.length - 1;
          const dist = step.distanceToNext;

          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onStepSelect(i, step.building)}
                className={`w-full text-left rounded-2xl px-3 py-2.5 transition-all duration-[250ms] ease-out focus:outline-none focus:ring-2 focus:ring-[#2563EB]/50
                  ${isActive
                    ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/25 scale-[1.02]'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'}
                  ${isPast && !isActive ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <Circle
                    size={8}
                    fill={isActive ? 'currentColor' : 'none'}
                    strokeWidth={2}
                    className={isActive ? 'text-white' : 'text-[#2563EB]'}
                  />
                  <span className={`text-sm font-semibold truncate ${isActive ? '' : ''}`}>
                    {step.label}
                  </span>
                </div>
              </button>
              {showArrow && dist > 0 && (
                <div className="flex flex-col items-center py-1 text-slate-400">
                  <ChevronDown size={16} strokeWidth={2} />
                  <span className="text-[11px] font-medium tabular-nums">{dist} m</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default memo(NavigationGuide);
