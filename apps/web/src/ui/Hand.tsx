import type { CardInstance, PlayerId } from '@ptcg/engine';
import { CardView } from './CardView.tsx';

interface Props {
  /** Whose hand it is (for the animations). */
  owner?: PlayerId;
  cards: CardInstance[];
  playable(uid: string): boolean;
  selectedUid?: string | null;
  onCard(uid: string): void;
}

export function Hand({ owner, cards, playable, selectedUid, onCard }: Props) {
  return (
    <section
      aria-label="Your hand"
      data-hand-of={owner}
      className="retro-box flex snap-x flex-nowrap justify-start gap-1.5 overflow-x-auto p-3 lg:shrink-0 lg:p-2"
    >
      {cards.length === 0 && <span className="py-6 text-xl opacity-60">No cards in hand</span>}
      {cards.map((c) => {
        const ok = playable(c.uid);
        return (
          <div key={c.uid} data-hand-card={c.uid} className={`shrink-0 snap-start ${ok ? '' : 'opacity-60'}`}>
            <CardView
              card={c}
              size="hand"
              onClick={() => onCard(c.uid)}
              highlighted={ok}
              selected={c.uid === selectedUid}
            />
          </div>
        );
      })}
    </section>
  );
}
