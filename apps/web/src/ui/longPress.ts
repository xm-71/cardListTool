import { useRef, type PointerEvent, type MouseEvent } from 'react';

/** How long a finger or mouse button must stay down to count as a long press. */
export const LONG_PRESS_MS = 450;
/** Moving further than this (px) turns the press into a scroll or drag, not a long press. */
const MOVE_LIMIT = 10;

/**
 * Handlers for "press and hold": `onLong` fires once after `ms` if the pointer stays put. A hold that fired
 * swallows the click that follows it (`consumeClick`) and the context menu browsers open on a long touch.
 */
export function useLongPress(onLong: () => void, ms = LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => {
    clearTimeout(timer.current);
    origin.current = null;
  };
  return {
    handlers: {
      onPointerDown(e: PointerEvent) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        fired.current = false;
        clear();
        origin.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          fired.current = true;
          origin.current = null;
          onLong();
        }, ms);
      },
      onPointerMove(e: PointerEvent) {
        const o = origin.current;
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_LIMIT) clear();
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
      onContextMenu(e: MouseEvent) {
        if (fired.current) e.preventDefault();
      },
    },
    /** True once (and resets) when the click that ends a long press arrives. */
    consumeClick(): boolean {
      const was = fired.current;
      fired.current = false;
      return was;
    },
  };
}
