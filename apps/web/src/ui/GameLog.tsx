import { useEffect, useRef } from 'react';
import type { GameEvent, PlayerId } from '@ptcg/engine';

export function GameLog({ log, me }: { log: GameEvent[]; me: PlayerId }) {
  const end = useRef<HTMLDivElement>(null);
  // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect's return value is
  // treated as its cleanup function (calling a Promise crashed the board on mobile Chrome).
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [log.length]);
  const recent = log.slice(-200);
  return (
    <section
      aria-label="Game log"
      className="retro-box flex min-h-0 flex-1 flex-col overflow-auto p-3 text-lg leading-tight"
    >
      {recent.map((e, i) => (
        <div
          key={log.length - recent.length + i}
          className={
            e.type === 'turnStart'
              ? 'mt-2 font-pixel text-[8px] uppercase'
              : e.player === undefined
                ? 'opacity-70'
                : e.player === me
                  ? 'text-blue-fg'
                  : 'text-red-fg'
          }
        >
          {e.text}
        </div>
      ))}
      <div ref={end} />
    </section>
  );
}
