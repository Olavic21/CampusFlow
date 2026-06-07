import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from 'framer-motion';
import { X } from 'lucide-react';

const SNAP_POINTS = [0.25, 0.5, 0.9];

function nearestSnap(ratio, points) {
  return points.reduce((best, p) =>
    Math.abs(p - ratio) < Math.abs(best - ratio) ? p : best,
  points[0]);
}

function BottomSheet({
  open,
  onClose,
  title,
  children,
  snapPoints = SNAP_POINTS,
  initialSnap = 0.5,
  showHandle = true,
  className = '',
}) {
  const sheetRef = useRef(null);
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const [vh, setVh] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );
  const [activeSnap, setActiveSnap] = useState(initialSnap);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (open) setActiveSnap(initialSnap);
  }, [open, initialSnap]);

  const snapTo = useCallback(
    (ratio) => {
      const h = vh * (1 - ratio);
      setActiveSnap(ratio);
      animate(y, h, { type: 'spring', damping: 28, stiffness: 320 });
    },
    [vh, y],
  );

  useEffect(() => {
    if (open) snapTo(initialSnap);
  }, [open, initialSnap, snapTo]);

  const handleDragEnd = useCallback(
    (_, info) => {
      const currentY = y.get();
      const visibleRatio = 1 - currentY / vh;
      if (visibleRatio < 0.12 || info.velocity.y > 600) {
        onClose?.();
        return;
      }
      snapTo(nearestSnap(visibleRatio, snapPoints));
    },
    [y, vh, snapPoints, snapTo, onClose],
  );

  const sheetHeight = vh * activeSnap;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[540] md:hidden"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={sheetRef}
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: vh * (1 - Math.max(...snapPoints)), bottom: vh * 0.85 }}
            dragElastic={0.08}
            style={{ y, height: sheetHeight }}
            onDragEnd={handleDragEnd}
            initial={{ y: vh }}
            animate={{ y: vh * (1 - activeSnap) }}
            exit={{ y: vh }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={`fixed inset-x-0 bottom-0 z-[550] flex flex-col bg-white dark:bg-slate-900 rounded-t-[24px] shadow-2xl overflow-hidden md:hidden ${className}`}
          >
            {showHandle && (
              <div
                className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
              </div>
            )}
            {title && (
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <h2 className="font-bold text-slate-800 dark:text-white text-sm truncate pr-2">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="cf-touch-target p-2 -mr-2 text-slate-400 hover:text-slate-600"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto sidebar-scroll overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default memo(BottomSheet);
