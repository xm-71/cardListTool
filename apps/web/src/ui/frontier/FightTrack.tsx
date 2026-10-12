import type { FrontierRun } from '../../game/frontier/run.ts';

const BAND = { easy: 'E', medium: 'M', hard: 'H' } as const;

/** The 8 fights of a run: done, current and still to come; the last one is the boss. */
export function FightTrack({ run }: { run: FrontierRun }) {
  return (
    <ol aria-label="Fight track" className="flex flex-wrap gap-2">
      {run.opponents.map((o, i) => {
        const boss = i === run.opponents.length - 1;
        const done = i < run.wins;
        return (
          <li
            key={i}
            aria-current={i === run.fight && run.phase !== 'over' ? 'step' : undefined}
            title={`${o.name} (${o.difficulty})`}
            className={`flex h-12 min-w-12 flex-col items-center justify-center border-4 border-ink px-1 font-pixel text-[9px] ${done ? 'bg-green/40' : i === run.fight ? 'bg-yellow text-ink-fixed' : 'bg-paper'}`}
          >
            <span>{done ? '✓' : i + 1}</span>
            <span className="text-[7px]">{boss ? 'Boss' : BAND[o.difficulty]}</span>
          </li>
        );
      })}
    </ol>
  );
}
