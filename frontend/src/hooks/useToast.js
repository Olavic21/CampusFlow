import { useState, useCallback, useRef } from 'react';

let toastSeq = 0;

/**
 * @param {'success'|'info'|'warning'|'error'|'saturation'} type
 * @param {string} message
 * @param {number} [durationMs]
 */
export function useToast(defaultDuration = 6000) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (type, message, durationMs = defaultDuration) => {
      const id = ++toastSeq;
      setToasts((t) => [...t.slice(-4), { id, type, message }]);
      if (durationMs > 0) {
        const timer = setTimeout(() => dismiss(id), durationMs);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [defaultDuration, dismiss],
  );

  return { toasts, push, dismiss };
}
