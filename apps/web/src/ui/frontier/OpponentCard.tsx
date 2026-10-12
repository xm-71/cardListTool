import { registry } from '../../game/catalog.ts';
import { FRONTIER_BRAINS, type FrontierOpponent } from '../../game/frontier/opponents.ts';

const BOT = { easy: 'Easy bot', medium: 'Medium bot', hard: 'Hard bot' } as const;

/** The next opponent: cover card, deck name, type, bot strength, and the Frontier Brain for the boss. */
export function OpponentCard({ opponent, fight }: { opponent: FrontierOpponent; fight: number }) {
  const def = registry.defs[opponent.cover];
  return (
    <section aria-label="Next opponent" className="retro-box flex flex-wrap items-center gap-4 p-4">
      {def && (
        <img
          src={`${def.image}/low.webp`}
          alt={opponent.name}
          className="retro-shadow w-24 rounded-md border-4 border-ink"
        />
      )}
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <p className="font-pixel text-[9px] opacity-70">Fight {fight + 1} of 8</p>
        {opponent.brain && (
          <p className="font-pixel text-[10px] text-red-fg">Frontier Brain {opponent.brain}</p>
        )}
        <h3 className="font-pixel text-xs">{opponent.name}</h3>
        <p className="text-xl">
          {opponent.type} · {BOT[opponent.difficulty]}
        </p>
      </div>
      {opponent.brain && <q className="w-full text-xl">{FRONTIER_BRAINS[opponent.id]?.intro}</q>}
    </section>
  );
}
