import { useEffect, useRef } from 'react';
import type { GameEvent, PlayerId } from '@ptcg/engine';

export function GameLog({ log, me }: { log: GameEvent[]; me: PlayerId }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView?.({ block: 'end' }), [log.length]);
  const recent = log.slice(-200);
  return (
    <section
      aria-label="Game log"
      className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl bg-black/30 p-2 text-xs"
    >
      {recent.map((e, i) => (
        <div
          key={log.length - recent.length + i}
          className={
            e.type === 'turnStart'
              ? 'mt-2 font-semibold text-amber-300'
              : e.player === undefined
                ? 'text-white/70'
                : e.player === me
                  ? 'text-sky-200'
                  : 'text-rose-200'
          }
        >
          {e.text}
        </div>
      ))}
      <div ref={end} />
    </section>
  );
}
