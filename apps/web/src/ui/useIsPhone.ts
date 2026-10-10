import { useEffect, useState } from 'react';

const QUERY = '(max-width: 1023px)';

/** Whether the window is a phone width right now (false when `matchMedia` is missing). */
export const isPhoneNow = (): boolean => typeof matchMedia === 'function' && matchMedia(QUERY).matches;

/** Whether the window is narrower than Tailwind's `lg` breakpoint (false when `matchMedia` is missing). */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(isPhoneNow);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mql = matchMedia(QUERY);
    const update = () => setPhone(mql.matches);
    update();
    mql.addEventListener?.('change', update);
    return () => mql.removeEventListener?.('change', update);
  }, []);
  return phone;
}
