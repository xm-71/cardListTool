import { CardView } from './CardView.tsx';
import { usePreview } from './preview.ts';

export function CardPreview() {
  const card = usePreview((s) => s.card);
  if (!card)
    return (
      <div className="flex aspect-[63/88] w-64 lg:w-[min(16rem,32vh)] items-center justify-center border-4 border-dashed border-ink/30 font-pixel text-[9px] uppercase opacity-60">
        Hover a card to zoom
      </div>
    );
  return <CardView key={card.uid} card={card} size="zoom" noPreview />;
}
