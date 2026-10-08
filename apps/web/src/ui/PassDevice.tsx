import { useEffect } from 'react';
import { usePreview } from './preview.ts';

export function PassDevice({ player, onReady }: { player: number; onReady(): void }) {
  // Never carry the previous player's zoomed card over to the next player.
  useEffect(() => usePreview.getState().show(null), []);
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-felt-dark p-6 text-center">
      <h2 className="text-3xl font-bold">Pass to Player {player + 1}</h2>
      <p className="text-white/60">Make sure the other player can't see the screen.</p>
      <button
        type="button"
        onClick={onReady}
        className="rounded-lg bg-amber-400 px-8 py-3 font-semibold text-slate-900 hover:bg-amber-300"
      >
        Ready
      </button>
    </div>
  );
}
