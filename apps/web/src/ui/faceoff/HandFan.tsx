import type { CSSProperties } from 'react';
import type { CardInstance, PlayerId } from '@ptcg/engine';
import { CardView } from '../CardView.tsx';

interface Props {
  /** Whose hand it is (for the animations). */
  owner: PlayerId;
  cards: CardInstance[];
  playable(uid: string): boolean;
  /** The card the player has lifted. */
  held: string | null;
  onCard(uid: string): void;
}

/** Your hand, always on screen: a fan along the bottom that overlaps when crowded. A tapped card lifts. */
export function HandFan({ owner, cards, playable, held, onCard }: Props) {
  const n = cards.length;
  const mid = (n - 1) / 2;
  // Overlap just enough for every card to fit the width (24px of gutter, room for the tilt), never spreading wider than 4px apart.
  const gap = n > 1 ? `min(4px, calc((100vw - 24px - ${n} * var(--fo-hand)) / ${n - 1}))` : '0px';
  return (
    <section
      aria-label="Your hand"
      data-hand-of={owner}
      className="flex justify-center px-2 pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
    >
      {n === 0 && <span className="py-4 text-xl opacity-60">No cards in hand</span>}
      {cards.map((c, i) => {
        const lifted = c.uid === held;
        const off = i - mid;
        const style: CSSProperties = {
          marginLeft: i === 0 ? 0 : gap,
          transform: lifted
            ? 'translateY(-22%) scale(1.08)'
            : `translateY(${Math.abs(off) * 3}px) rotate(${off * 3}deg)`,
          zIndex: lifted ? 20 : i + 1,
        };
        return (
          <div
            key={c.uid}
            data-hand-card={c.uid}
            style={style}
            className={`relative shrink-0 transition-transform duration-150 ${playable(c.uid) ? '' : 'opacity-60'}`}
          >
            <CardView
              card={c}
              size="foHand"
              onClick={() => onCard(c.uid)}
              highlighted={playable(c.uid) && !lifted}
              selected={lifted}
            />
          </div>
        );
      })}
    </section>
  );
}
