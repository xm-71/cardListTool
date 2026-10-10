import type { Action, CardInstance, PlayerView } from '@ptcg/engine';
import { describeAction } from '../game/actions.ts';
import type { PanelAttack, PanelModel } from '../game/selection.ts';
import { defOf } from '../game/view.ts';
import { CardView } from './CardView.tsx';
import { EnergyDot } from './energy.tsx';
import { SlotView } from './SlotView.tsx';

interface Props {
  view: PlayerView;
  /** "Turn 3 · Your turn". */
  status: string;
  model: PanelModel | null;
  onAct(action: Action): void;
  onDetails(card: CardInstance): void;
  /** The Stadium in play, and the action that uses it when that is legal. */
  stadium?: { card: CardInstance; action?: Action };
}

const item =
  'flex w-full items-center gap-2 border-2 border-ink bg-paper px-2 py-1.5 text-left text-lg leading-tight hover:bg-yellow/40 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-paper';

/** The attack as the action label spells it, e.g. "Attack: Gnaw (40)". */
const attackLabel = (a: PanelAttack): string => `Attack: ${a.name}${a.damage ? ` (${a.damage})` : ''}`;

/**
 * What can be done with the card or Pokémon the player picked: the card itself, its attacks (those that cannot be
 * used yet are greyed out), and every other action. It replaces the hover zoom and the popup menu.
 */
export function SelectionPanel({ view, status, model, onAct, onDetails, stadium }: Props) {
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 font-pixel text-[9px] uppercase">
        <span className="border-2 border-ink bg-yellow px-2 py-1">{status}</span>
        {stadium && (
          <span className="flex items-center gap-1 normal-case">
            Stadium: <CardView card={stadium.card} size="xs" />
          </span>
        )}
      </div>
      {model ? (
        <>
          <div className="flex justify-center">
            {model.slot ? (
              <SlotView slot={model.slot} size="panel" />
            ) : (
              <CardView card={model.card} size="panel" />
            )}
          </div>
          <button
            type="button"
            onClick={() => onDetails(model.card)}
            className="self-center border-2 border-ink bg-paper px-3 py-1.5 font-pixel text-[8px] uppercase text-ink hover:bg-cream"
          >
            Card details
          </button>
          <div role="menu" aria-label={defOf(model.card).name} className="flex flex-col gap-1.5">
            {model.attacks.map((a) => (
              <button
                key={`attack-${a.index}`}
                role="menuitem"
                type="button"
                aria-label={attackLabel(a)}
                disabled={!a.action}
                onClick={() => a.action && onAct(a.action)}
                className={item}
              >
                <span className="flex shrink-0 gap-0.5">
                  {a.cost.map((c, i) => (
                    <EnergyDot key={i} type={c} />
                  ))}
                </span>
                <span className="flex-1">{a.name}</span>
                {a.damage && <span>{a.damage}</span>}
              </button>
            ))}
            {model.actions.map((a, i) => (
              <button
                key={`action-${i}`}
                role="menuitem"
                type="button"
                onClick={() => onAct(a)}
                className={item}
              >
                {describeAction(a, view)}
              </button>
            ))}
            {stadium?.action && (
              <button role="menuitem" type="button" onClick={() => onAct(stadium.action!)} className={item}>
                {describeAction(stadium.action, view)}
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-xl opacity-70">Tap a card to see what it can do.</p>
          {stadium?.action && (
            <div role="menu" aria-label="Stadium">
              <button role="menuitem" type="button" onClick={() => onAct(stadium.action!)} className={item}>
                {describeAction(stadium.action, view)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
