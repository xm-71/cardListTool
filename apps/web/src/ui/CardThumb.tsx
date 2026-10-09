import { useState } from 'react';
import type { CardDef } from '@ptcg/engine';

/** A small picture of a card for list rows (decorative: the row already names the card). Hidden if it can't load. */
export function CardThumb({ def }: { def: CardDef }) {
  const [failed, setFailed] = useState(false);
  if (failed || !def.image) return <span className="aspect-[63/88] w-9 shrink-0" aria-hidden />;
  return (
    <img
      src={`${def.image}/low.webp`}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className="aspect-[63/88] w-9 shrink-0 rounded-[6%] object-cover"
    />
  );
}
