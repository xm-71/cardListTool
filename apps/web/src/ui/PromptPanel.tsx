import { useEffect, useRef } from 'react';
import type { Action, PlayerView, Prompt } from '@ptcg/engine';
import { slotAt } from '../game/view.ts';
import { CardView } from './CardView.tsx';
import { SlotView } from './SlotView.tsx';

/** Clicks this soon after a prompt appears are treated as leftovers of a double click. */
const SETTLE_MS = 300;

interface Props {
  prompt: Prompt;
  view: PlayerView;
  legal: Action[];
  onAnswer(optionId: string): void;
}

/** Bottom sheet for a choice the engine is waiting on (setup picks, searches, targets, yes/no). */
export function PromptPanel({ prompt, view, legal, onAnswer }: Props) {
  const canFinish = legal.some((a) => a.type === 'answer' && a.optionId === 'done');
  const shownAt = useRef(Date.now());
  const key = `${prompt.message}|${prompt.selected.join(',')}|${prompt.options.map((o) => o.id).join(',')}`;
  useEffect(() => {
    shownAt.current = Date.now();
  }, [key]);
  const settled = (fn: () => void) => () => {
    if (Date.now() - shownAt.current >= SETTLE_MS) fn();
  };
  return (
    <div
      role="dialog"
      aria-label={prompt.message}
      className="retro-box fixed inset-x-0 bottom-0 z-20 max-h-[60vh] overflow-auto p-4"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl">{prompt.message}</h2>
          <span className="font-pixel text-[9px]">
            Selected {prompt.selected.length} of {prompt.max}
            {prompt.min > 0 ? ` (at least ${prompt.min})` : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {prompt.options.map((o) => {
            const answer = settled(() => onAnswer(o.id));
            if (o.uid && o.defId) {
              return (
                <CardView
                  key={o.id}
                  card={{ uid: o.uid, defId: o.defId, owner: view.me }}
                  size="md"
                  onClick={answer}
                />
              );
            }
            const slot = o.slot ? slotAt(view, o.slot) : null;
            if (slot) return <SlotView key={o.id} slot={slot} size="md" onClick={answer} />;
            return <OptionButton key={o.id} label={o.label} onClick={answer} />;
          })}
        </div>
        {canFinish && (
          <button
            type="button"
            className="self-end retro-shadow border-4 border-ink bg-yellow px-4 py-2 font-pixel text-[10px] uppercase text-ink hover:brightness-105"
            onClick={settled(() => onAnswer('done'))}
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

function OptionButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button
      type="button"
      className="border-4 border-ink bg-paper px-3 py-2 text-xl hover:bg-yellow"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
