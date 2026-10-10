import type { CardInstance } from '@ptcg/engine';
import { CardView } from './CardView.tsx';

interface Props {
  cards: CardInstance[];
  playable(uid: string): boolean;
  onCard(uid: string): void;
}

export function Hand({ cards, playable, onCard }: Props) {
  return (
    <section
      aria-label="Your hand"
      className="retro-box flex snap-x flex-nowrap justify-start gap-1.5 overflow-x-auto p-3 lg:shrink-0 lg:p-2"
    >
      {cards.length === 0 && <span className="py-6 text-xl opacity-60">No cards in hand</span>}
      {cards.map((c) => {
        const ok = playable(c.uid);
        return (
          <div key={c.uid} className={`shrink-0 snap-start ${ok ? '' : 'opacity-60'}`}>
            <CardView card={c} size="hand" onClick={() => onCard(c.uid)} highlighted={ok} />
          </div>
        );
      })}
    </section>
  );
}
