import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** Extra classes for the panel, e.g. a height limit. */
  className?: string;
}

/** A bottom sheet: a dialog that slides over the screen, closes with ×, Escape or a tap outside, and gives focus back. */
export function Sheet({ title, onClose, children, className = '' }: Props) {
  const opener = useRef<Element | null>(document.activeElement);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    const back = opener.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      if (back instanceof HTMLElement) back.focus();
    };
  }, []);
  return (
    <div
      data-testid="sheet-backdrop"
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={title}
        className={`retro-box sheet-in flex max-h-[85dvh] w-full max-w-xl flex-col gap-3 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-pixel text-[10px] uppercase">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="border-4 border-ink bg-paper px-3 py-1 font-pixel text-[10px] hover:bg-cream"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
