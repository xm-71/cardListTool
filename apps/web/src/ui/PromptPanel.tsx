import type { Action, PlayerView, Prompt } from '@ptcg/engine';
import { slotAt, topCard } from '../game/view.ts';
import { CardView } from './CardView.tsx';

interface Props {
  prompt: Prompt;
  view: PlayerView;
  legal: Action[];
  onAnswer(optionId: string): void;
}

/** Bottom sheet for a choice the engine is waiting on (setup picks, searches, targets, yes/no). */
export function PromptPanel({ prompt, view, legal, onAnswer }: Props) {
  const canFinish = legal.some((a) => a.type === 'answer' && a.optionId === 'done');
  return (
    <div
      role="dialog"
      aria-label={prompt.message}
      className="fixed inset-x-0 bottom-0 z-20 max-h-[60vh] overflow-auto border-t border-amber-400/40 bg-slate-950/95 p-4 shadow-2xl backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-amber-300">{prompt.message}</h2>
          <span className="text-sm text-white/60">
            Selected {prompt.selected.length} of {prompt.max}
            {prompt.min > 0 ? ` (at least ${prompt.min})` : ''}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {prompt.options.map((o) => {
            const answer = () => onAnswer(o.id);
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
            if (slot) return <CardView key={o.id} card={topCard(slot)} size="md" onClick={answer} />;
            return <OptionButton key={o.id} label={o.label} onClick={answer} />;
          })}
        </div>
        {canFinish && (
          <button
            type="button"
            className="self-end rounded-lg bg-amber-400 px-5 py-2 font-semibold text-slate-900 hover:bg-amber-300"
            onClick={() => onAnswer('done')}
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
      className="rounded-lg bg-white/10 px-4 py-2 hover:bg-amber-400 hover:text-slate-900"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
