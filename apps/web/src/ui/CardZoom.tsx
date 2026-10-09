import { useEffect } from 'react';
import { CardView } from './CardView.tsx';
import { usePreview } from './preview.ts';
import { Button } from './retro/index.ts';

/** A card opened full size (long press), over everything else. Tap anywhere, press Escape or Close to dismiss. */
export function CardZoom() {
  const card = usePreview((s) => s.zoomed);
  const zoom = usePreview((s) => s.zoom);
  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && zoom(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, zoom]);
  if (!card) return null;
  return (
    <div
      role="dialog"
      aria-label="Card view"
      onClick={() => zoom(null)}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink/85 p-4"
    >
      <CardView card={card} size="lg" noPreview />
      <Button onClick={() => zoom(null)}>Close</Button>
    </div>
  );
}
