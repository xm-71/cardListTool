import { useEffect } from 'react';
import type { CardInstance } from '@ptcg/engine';
import { CardView } from './CardView.tsx';
import { Button } from './retro/index.ts';

/** Every card in a discard pile, newest first, as card art (long-press or hover one to see it larger). */
export function DiscardViewer({
  label,
  cards,
  onClose,
}: {
  label: string;
  cards: readonly CardInstance[];
  onClose(): void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-label={`${label} discard pile`}
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-fixed/80 p-4"
    >
      <div className="retro-box flex max-h-full w-full max-w-3xl flex-col gap-3 overflow-auto p-4">
        <h2 className="font-pixel text-xs uppercase">
          {label}: discard pile ({cards.length})
        </h2>
        <ul className="flex flex-wrap gap-2">
          {[...cards].reverse().map((c) => (
            <li key={c.uid}>
              <CardView card={c} size="sm" />
            </li>
          ))}
        </ul>
        <Button className="self-start" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
