import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Accessibilité modale / bottom-sheet (audit P1 a11y) :
 *  — piège de focus (Tab / Shift+Tab restent dans le dialogue)
 *  — fermeture avec Escape
 *  — focus initial sur le premier élément focusable
 *  — restauration du focus à la fermeture
 *
 * @param {{open: boolean, onClose?: Function, containerRef?: React.RefObject}} options
 * @returns {React.RefObject} — à attacher au conteneur du dialogue.
 */
export function useModalA11y({ open, onClose, containerRef: externalRef } = {}) {
  const internalRef = useRef(null);
  const ref = externalRef || internalRef;

  useEffect(() => {
    if (!open) return undefined;
    const container = ref.current;
    if (!container) return undefined;

    const previous = document.activeElement;

    const focusables = () =>
      Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.getClientRects().length > 0,
      );

    (focusables()[0] || container)?.focus?.();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKey);
    return () => {
      container.removeEventListener('keydown', onKey);
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [open, onClose, ref]);

  return ref;
}