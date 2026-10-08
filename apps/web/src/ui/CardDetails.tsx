import type { CardInstance } from '@ptcg/engine';
import { defOf } from '../game/view.ts';
import { CardView, TextCard } from './CardView.tsx';

/** Full-size card plus its full text; reachable on any screen size by clicking a card. */
export function CardDetails({ card, onClose }: { card: CardInstance; onClose(): void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Card details"
        className="retro-box flex max-h-full flex-col items-center gap-3 overflow-auto p-4 sm:flex-row sm:items-start"
        onClick={(e) => e.stopPropagation()}
      >
        <CardView card={card} size="lg" noPreview />
        <div className="w-64 sm:w-72">
          <div className="aspect-[63/88] w-full">
            <TextCard def={defOf(card)} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full border-4 border-ink bg-paper px-3 py-2 font-pixel text-[10px] uppercase text-ink hover:bg-cream"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
