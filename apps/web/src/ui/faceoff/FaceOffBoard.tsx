import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Action, CardInstance, PlayerId, PlayerView, SlotRef, SlotView } from '@ptcg/engine';
import { actionsForSlot, describeAction } from '../../game/actions.ts';
import { panelModel } from '../../game/selection.ts';
import { targetsFor, untargeted, type Target } from '../../game/targets.ts';
import { defOf, sameRef, topCard } from '../../game/view.ts';
import { CardView } from '../CardView.tsx';
import { DiscardViewer } from '../DiscardViewer.tsx';
import { ActionMenu, type MenuItem } from './ActionMenu.tsx';
import { FoSlot } from './FoSlot.tsx';
import { HandFan } from './HandFan.tsx';

interface Props {
  view: PlayerView;
  viewer: PlayerId;
  /** The viewer's legal actions right now (empty when it is not their move). */
  legal: Action[];
  /** The ticker line (turn, and each move as it plays). */
  ticker: ReactNode;
  opponentName: string;
  benchSize: number;
  onAct(action: Action): void;
  /** Missing when ending the turn is not legal right now. */
  onEndTurn?: () => void;
  onDetails(card: CardInstance): void;
  /** The Menu button (log, Concede, Quit). */
  menu: ReactNode;
}

/** Card widths: each fits the screen's width and height so the whole board is one screen. */
const SIZES = {
  '--fo-bench': 'min(13vw, 56px, 6.5dvh)',
  '--fo-opp': 'min(29vw, 120px, 14dvh)',
  '--fo-you': 'min(33vw, 140px, 16dvh)',
  '--fo-hand': 'min(19vw, 84px, 9.5dvh)',
} as CSSProperties;

type Open = { kind: 'slot'; ref: SlotRef } | { kind: 'stadium' } | { kind: 'choice'; actions: Action[] };

/**
 * Phones: the two Active Pokémon face each other in the middle, the Benches run along the edges, and the hand is
 * always fanned at the bottom. Tap a hand card, then a glowing spot; tap your Pokémon for its attacks.
 */
export function FaceOffBoard({
  view,
  viewer,
  legal,
  ticker,
  opponentName,
  benchSize,
  onAct,
  onEndTurn,
  onDetails,
  menu,
}: Props) {
  const [heldUid, setHeld] = useState<string | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [discard, setDiscard] = useState<'you' | 'opponent' | null>(null);
  const opp: PlayerId = viewer === 0 ? 1 : 0;
  const usable = view.prompt ? [] : legal;
  // A held card that left the hand (played, discarded) is let go.
  const held = heldUid && view.you.hand.some((c) => c.uid === heldUid) ? heldUid : null;
  const targets: Target[] = held ? targetsFor(usable, held) : [];
  const plays = held ? untargeted(usable, held) : [];

  const act = (a: Action) => {
    setHeld(null);
    setOpen(null);
    onAct(a);
  };
  const pick = (t: Target) =>
    t.actions.length === 1 ? act(t.actions[0]!) : setOpen({ kind: 'choice', actions: t.actions });
  const targetAt = (ref: SlotRef | 'bench') =>
    targets.find((t) =>
      ref === 'bench' || t.target === 'bench' ? t.target === ref : sameRef(t.target, ref),
    );

  // Only what the Pokémon itself can do rings it (attacks, Abilities), not every card that could go onto it.
  const canUse = (ref: SlotRef) =>
    actionsForSlot(usable, ref, viewer).some((a) => a.type === 'attack' || a.type === 'useAbility');

  const tapSlot = (ref: SlotRef, slot: SlotView) => {
    const t = targetAt(ref);
    if (t) return pick(t);
    setHeld(null);
    if (ref.player === viewer) setOpen({ kind: 'slot', ref });
    else onDetails(topCard(slot));
  };

  const slotView = (ref: SlotRef, slot: SlotView | null, size: 'foBench' | 'foOpp' | 'foYou') =>
    slot ? (
      <FoSlot
        slot={slot}
        size={size}
        target={!!targetAt(ref)}
        highlighted={!held && ref.player === viewer && canUse(ref)}
        selected={open?.kind === 'slot' && sameRef(open.ref, ref)}
        onClick={() => tapSlot(ref, slot)}
      />
    ) : (
      <div
        className={`aspect-[63/88] ${size === 'foYou' ? 'w-[var(--fo-you)]' : 'w-[var(--fo-opp)]'} border-4 border-dashed border-ink/30`}
      />
    );

  const bench = (player: PlayerId, side: PlayerView['you'] | PlayerView['opponent']) => {
    const benchTarget = player === viewer ? targetAt('bench') : undefined;
    return (
      <div className="flex justify-center gap-[1.5vw]">
        {Array.from({ length: benchSize }, (_, index) => {
          const slot = side.bench[index];
          if (slot)
            return <div key={index}>{slotView({ player, zone: 'bench', index }, slot, 'foBench')}</div>;
          const glow = benchTarget && index === side.bench.length;
          return glow ? (
            <button
              key={index}
              type="button"
              aria-label="Empty Bench space"
              data-target=""
              data-bench-space-of={player}
              onClick={() => pick(benchTarget)}
              className="aspect-[63/88] w-[var(--fo-bench)] border-2 border-dashed border-yellow bg-yellow/20 shadow-[0_0_12px_3px_var(--color-yellow)] motion-safe:animate-pulse"
            />
          ) : (
            <div
              key={index}
              data-bench-space-of={player}
              className="aspect-[63/88] w-[var(--fo-bench)] border-2 border-dashed border-ink/25"
            />
          );
        })}
      </div>
    );
  };

  const piles = (side: PlayerView['you'] | PlayerView['opponent'], who: 'you' | 'opponent') => (
    <div className="flex flex-col items-center gap-1 text-base leading-none">
      <div
        data-deck-of={who === 'you' ? viewer : opp}
        className="card-back relative flex aspect-[63/88] w-[min(9vw,40px)] items-end justify-center border-2 border-ink pb-0.5 text-paper-fixed"
      >
        <span className="relative z-10 font-pixel text-[7px] [text-shadow:1px_1px_var(--color-ink-fixed)]">
          {side.deckCount}
        </span>
      </div>
      <button
        type="button"
        disabled={side.discard.length === 0}
        onClick={() => setDiscard(who)}
        className="underline disabled:no-underline"
      >
        Discard {side.discard.length}
      </button>
    </div>
  );

  const prizes = (count: number, label: string, player: PlayerId) => (
    <div
      aria-label={`${label}: ${count} Prizes`}
      className="grid grid-cols-3 gap-0.5"
      data-prizes
      data-prizes-of={player}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className={`h-3 w-2.5 border-2 border-ink ${i < count ? 'bg-blue' : 'border-dashed bg-transparent opacity-50'}`}
        />
      ))}
    </div>
  );

  const menuItems = (): { title: string; items: MenuItem[] } | null => {
    if (!open) return null;
    if (open.kind === 'choice')
      return {
        title: 'Choose',
        items: open.actions.map((a) => ({ label: describeAction(a, view), onClick: () => act(a) })),
      };
    if (open.kind === 'stadium') {
      const card = view.stadium?.card;
      if (!card) return null;
      const use = usable.find((a) => a.type === 'useStadium');
      return {
        title: defOf(card).name,
        items: [
          ...(use ? [{ label: describeAction(use, view), onClick: () => act(use) }] : []),
          { label: 'Card details', onClick: () => (setOpen(null), onDetails(card)) },
        ],
      };
    }
    const model = panelModel(view, usable, { kind: 'slot', ref: open.ref }, viewer);
    if (!model) return null;
    return {
      title: defOf(model.card).name,
      items: [
        ...model.attacks.map((a) => ({
          label: `Attack: ${a.name}${a.damage ? ` (${a.damage})` : ''}`,
          cost: a.cost,
          disabled: !a.action,
          onClick: () => a.action && act(a.action),
        })),
        // Cards played onto it (Energy, evolutions, Tools) come from the hand, so only its own moves are here.
        ...model.actions
          .filter((a) => a.type === 'useAbility' || a.type === 'retreat')
          .map((a) => ({ label: describeAction(a, view), onClick: () => act(a) })),
        { label: 'Card details', onClick: () => (setOpen(null), onDetails(model.card)) },
      ],
    };
  };
  const m = menuItems();

  return (
    <div style={SIZES} className="play-mat relative flex h-dvh flex-col justify-between overflow-hidden">
      <section aria-label="Opponent" className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 border-b-2 border-ink/60 bg-paper/80 px-2 py-1 font-pixel text-[8px] uppercase">
          {menu}
          <span className="flex min-w-0 gap-1">
            <span className="truncate">{opponentName}</span>·
            <span className="shrink-0" data-hand-of={opp}>
              Hand {view.opponent.handCount}
            </span>
          </span>
          {prizes(view.opponent.prizeCount, opponentName, opp)}
        </div>
        {bench(opp, view.opponent)}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2">
          <span />
          <div data-active-of={opp}>
            {slotView({ player: opp, zone: 'active' }, view.opponent.active, 'foOpp')}
          </div>
          <div className="justify-self-end">{piles(view.opponent, 'opponent')}</div>
        </div>
      </section>

      <div className="flex min-w-0 items-center justify-center gap-2 px-2 font-pixel text-[8px] uppercase">
        {ticker}
        {view.stadium && (
          <button
            type="button"
            onClick={() => setOpen({ kind: 'stadium' })}
            className="flex items-center gap-1 border-2 border-ink bg-paper px-1 py-0.5"
          >
            Stadium
            <CardView card={view.stadium.card} size="chip" noPreview />
          </button>
        )}
      </div>

      <section aria-label="You" className="flex flex-col gap-1">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-2">
          <div className="justify-self-start">{prizes(view.you.prizeCount, 'You', viewer)}</div>
          <div data-active-of={viewer}>
            {slotView({ player: viewer, zone: 'active' }, view.you.active, 'foYou')}
          </div>
          <div className="flex flex-col items-end gap-2 justify-self-end">
            {piles(view.you, 'you')}
            {onEndTurn && (
              <button
                type="button"
                onClick={() => {
                  setHeld(null);
                  setOpen(null);
                  onEndTurn();
                }}
                className="retro-shadow border-4 border-ink bg-yellow px-2 py-2 font-pixel text-[9px] uppercase text-ink-fixed hover:brightness-105"
              >
                End turn
              </button>
            )}
          </div>
        </div>
        {bench(viewer, view.you)}
      </section>

      <div className="relative">
        {held && (plays.length > 0 || targets.length > 0) && (
          <div className="absolute inset-x-2 -top-2 z-20 flex -translate-y-full flex-wrap items-center justify-center gap-2">
            {plays.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => act(a)}
                className="retro-shadow border-4 border-ink bg-yellow px-3 py-1.5 font-pixel text-[9px] uppercase text-ink-fixed"
              >
                {describeAction(a, view)}
              </button>
            ))}
            {targets.length > 0 && (
              <span className="border-2 border-ink bg-paper px-2 py-1 font-pixel text-[7px] uppercase">
                Tap a glowing spot
              </span>
            )}
          </div>
        )}
        <HandFan
          owner={viewer}
          cards={view.you.hand}
          playable={(uid) => targetsFor(usable, uid).length > 0 || untargeted(usable, uid).length > 0}
          held={held}
          onCard={(uid) => {
            setOpen(null);
            setHeld((h) => (h === uid ? null : uid));
          }}
        />
      </div>

      {m && <ActionMenu title={m.title} items={m.items} onClose={() => setOpen(null)} />}
      {discard && (
        <DiscardViewer
          label={discard === 'you' ? 'You' : opponentName}
          cards={discard === 'you' ? view.you.discard : view.opponent.discard}
          onClose={() => setDiscard(null)}
        />
      )}
    </div>
  );
}
