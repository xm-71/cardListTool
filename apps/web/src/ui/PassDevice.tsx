import { useEffect } from 'react';
import { usePreview } from './preview.ts';

export function PassDevice({ player, onReady }: { player: number; onReady(): void }) {
  // Never carry the previous player's zoomed card over to the next player.
  useEffect(() => usePreview.getState().show(null), []);
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <h2 className="font-pixel text-lg uppercase">Pass to Player {player + 1}</h2>
      <p className="text-2xl">Make sure the other player can't see the screen.</p>
      <button
        type="button"
        onClick={onReady}
        className="retro-shadow border-4 border-ink bg-yellow px-4 py-2 font-pixel text-[10px] uppercase text-ink hover:brightness-105"
      >
        Ready
      </button>
    </div>
  );
}
