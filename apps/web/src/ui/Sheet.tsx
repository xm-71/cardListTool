import { useRef, type ReactNode } from 'react';
import { useDialog } from './binder/useDialog.ts';

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** The panel's height limit (a Tailwind max-h class). */
  className?: string;
}

/**
 * A bottom sheet: a dialog that slides over the screen, closes with ×, Escape or a tap outside. Focus moves into it,
 * Tab stays inside it, and focus goes back to whatever opened it.
 */
export function Sheet({ title, onClose, children, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onClose);
  return (
    <div
      data-testid="sheet-backdrop"
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink-fixed/40"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`retro-box sheet-in flex w-full max-w-xl flex-col gap-3 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${className}`}
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
