import { CardView } from './CardView.tsx';
import { usePreview } from './preview.ts';

export function CardPreview() {
  const card = usePreview((s) => s.card);
  if (!card)
    return (
      <div className="flex aspect-[63/88] w-64 items-center justify-center rounded-xl border border-dashed border-white/20 text-sm text-white/40">
        Hover a card to zoom
      </div>
    );
  return <CardView key={card.uid} card={card} size="lg" noPreview />;
}
