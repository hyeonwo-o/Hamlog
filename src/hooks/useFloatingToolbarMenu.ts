import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

interface FloatingMenuPosition {
  left: number;
  top: number;
  triggerWidth: number;
}

const VIEWPORT_MARGIN = 8;
const MENU_GAP = 4;

export function useFloatingToolbarMenu<
  TriggerElement extends HTMLElement,
  MenuElement extends HTMLElement
>(
  open: boolean,
  triggerRef: RefObject<TriggerElement>,
  menuRef: RefObject<MenuElement>
) {
  const [position, setPosition] = useState<FloatingMenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - menuRect.width - VIEWPORT_MARGIN);
    const left = Math.min(Math.max(triggerRect.left, VIEWPORT_MARGIN), maxLeft);

    const below = triggerRect.bottom + MENU_GAP;
    const above = triggerRect.top - menuRect.height - MENU_GAP;
    const top = below + menuRect.height <= window.innerHeight - VIEWPORT_MARGIN || above < VIEWPORT_MARGIN
      ? below
      : above;

    setPosition(current => (
      current
      && Math.abs(current.left - left) < 0.5
      && Math.abs(current.top - top) < 0.5
      && Math.abs(current.triggerWidth - triggerRect.width) < 0.5
        ? current
        : { left, top, triggerWidth: triggerRect.width }
    ));
  }, [menuRef, triggerRef]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  return position;
}
