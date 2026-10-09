import { useState } from 'react';

const KEY = 'ptcg-log-open';

/**
 * Whether the battle log is showing. On a phone it starts hidden (the board needs the room) unless the player
 * opened it before; the choice is remembered. Wide screens always show the log, whatever this says.
 */
export function useLogOpen(): [boolean, () => void] {
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved !== null) return saved === '1';
    } catch {
      // storage can be unavailable (private windows); use the default
    }
    return !(typeof matchMedia === 'function' && matchMedia('(max-width: 1023px)').matches);
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // not remembered
    }
  };
  return [open, toggle];
}
