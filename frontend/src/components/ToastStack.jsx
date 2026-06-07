import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STYLES = {
  success: 'bg-emerald-600 text-white',
  info: 'bg-slate-700 text-white',
  warning: 'bg-amber-500 text-slate-900',
  error: 'bg-red-600 text-white',
  saturation: 'bg-red-700 text-white ring-2 ring-red-300',
};

const ICONS = {
  success: '✓',
  info: 'ℹ',
  warning: '⚠',
  error: '✕',
  saturation: '🔴',
};

function ToastItem({ toast, onClose }) {
  const style = STYLES[toast.type] || STYLES.info;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      role="status"
      aria-live="polite"
      className={`rounded-xl px-4 py-3 shadow-xl max-w-sm flex items-start gap-2 ${style}`}
    >
      <span className="text-sm font-bold shrink-0" aria-hidden="true">
        {ICONS[toast.type] || '•'}
      </span>
      <span className="text-sm flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 opacity-80 hover:opacity-100 text-lg leading-none"
        aria-label="Fermer la notification"
      >
        ×
      </button>
    </motion.div>
  );
}

function ToastStack({ toasts, onDismiss }) {
  return (
    <div
      className="fixed top-4 right-4 z-[700] flex flex-col gap-2 pointer-events-none pt-safe pr-safe"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onClose={() => onDismiss(t.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default memo(ToastStack);
