import { useState } from 'react';
import { CardView } from './CardView.tsx';

const instance = (defId: string, i: number) => ({ uid: `pack-${i}`, defId, owner: 0 as const });

/** Reveals a freshly opened pack one card at a time. The cards are already saved when this shows. */
export function PackOpening({ cards, onDone }: { cards: string[]; onDone(): void }) {
  const [shown, setShown] = useState(1);
  const all = shown >= cards.length;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-label="Pack opening"
        className="flex max-h-full w-full max-w-4xl flex-col items-center gap-4 overflow-auto rounded-2xl bg-slate-900 p-6 shadow-2xl ring-1 ring-white/10"
      >
        {all ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {cards.map((id, i) => (
              <CardView key={i} card={instance(id, i)} size="md" noPreview />
            ))}
          </div>
        ) : (
          <>
            <p className="text-white/70">
              Card {shown} of {cards.length}
            </p>
            <CardView key={shown} card={instance(cards[shown - 1]!, shown - 1)} size="lg" noPreview />
          </>
        )}
        <div className="flex gap-3">
          {!all && (
            <>
              <button
                type="button"
                onClick={() => setShown(shown + 1)}
                className="rounded-lg bg-amber-400 px-5 py-2 font-semibold text-slate-900 hover:bg-amber-300"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => setShown(cards.length)}
                className="rounded-lg bg-white/10 px-5 py-2 hover:bg-white/20"
              >
                Reveal all
              </button>
            </>
          )}
          {all && (
            <button
              type="button"
              onClick={onDone}
              className="rounded-lg bg-amber-400 px-5 py-2 font-semibold text-slate-900 hover:bg-amber-300"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
