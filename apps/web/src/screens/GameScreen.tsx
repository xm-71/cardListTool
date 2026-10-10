import { useMemo, useState } from 'react';
import type { Action, CardInstance, PlayerId, SlotRef } from '@ptcg/engine';
import { actionsForCard, actionsForSlot, describeAction, globalActions } from '../game/actions.ts';
import { engine } from '../game/catalog.ts';
import { actorOf, useGame } from '../game/store.ts';
import { useNav } from '../nav/useNav.ts';
import { defOf, slotAt, topCard, topDef } from '../game/view.ts';
import { ActionMenu } from '../ui/ActionMenu.tsx';
import { CardDetails } from '../ui/CardDetails.tsx';
import { CardPreview } from '../ui/CardPreview.tsx';
import { CardView } from '../ui/CardView.tsx';
import { GameLog } from '../ui/GameLog.tsx';
import { useLogOpen } from '../ui/useLogOpen.ts';
import { useIsPhone } from '../ui/useIsPhone.ts';
import { ActionBar } from '../ui/ActionBar.tsx';
import { Hand } from '../ui/Hand.tsx';
import { PromptPanel } from '../ui/PromptPanel.tsx';
import { Side } from '../ui/Side.tsx';

interface Props {
  /** Seat whose view is shown. Defaults to the human seat (bot mode). */
  viewer?: PlayerId;
}

export function GameScreen({ viewer: viewerProp }: Props) {
  const state = useGame((s) => s.state);
  const human = useGame((s) => s.human);
  const dispatch = useGame((s) => s.dispatch);
  const reset = useGame((s) => s.reset);
  const [details, setDetails] = useState<CardInstance | null>(null);
  const [menu, setMenu] = useState<{ title: string; actions: Action[]; card: CardInstance } | null>(null);
  const viewer = viewerProp ?? human;
  const [logOpen, toggleLog] = useLogOpen();
  const phone = useIsPhone();

  const view = useMemo(() => (state ? engine.viewFor(state, viewer) : null), [state, viewer]);
  const legal = useMemo(
    () => (state && actorOf(state) === viewer ? engine.getLegalActions(state, viewer) : []),
    [state, viewer],
  );
  if (!state || !view) return null;
  const opp: PlayerId = viewer === 0 ? 1 : 0;
  const act = (a: Action) => {
    setMenu(null);
    dispatch(viewer, a);
  };
  const concede = () => {
    if (confirm('Concede this game?')) act({ type: 'concede' });
  };
  const quit = () => {
    if (!view.result && !confirm('Leave this game?')) return;
    // Quitting a Gym Challenge match counts as a loss, like conceding: the result screen follows.
    if (!view.result && useGame.getState().config?.context) {
      act({ type: 'concede' });
      return;
    }
    reset();
    useNav.getState().go('menu');
  };
  // Clicking a card opens what you can do with it, or just its details when there is nothing to do.
  const openSlot = (ref: SlotRef) => {
    const slot = slotAt(view, ref);
    if (!slot) return;
    const actions = view.prompt ? [] : actionsForSlot(legal, ref, viewer);
    if (actions.length) setMenu({ title: topDef(slot).name, actions, card: topCard(slot) });
    else setDetails(topCard(slot));
  };
  const openCard = (uid: string) => {
    const card = view.you.hand.find((c) => c.uid === uid);
    if (!card) return;
    const actions = view.prompt ? [] : actionsForCard(legal, uid);
    if (actions.length) setMenu({ title: defOf(card).name, actions, card });
    else setDetails(card);
  };
  const slotHasActions = (ref: SlotRef) => !view.prompt && actionsForSlot(legal, ref, viewer).length > 0;
  const myTurn = !view.prompt && legal.length > 0;
  const status = view.result
    ? 'Game over'
    : view.waitingOn !== null
      ? 'Waiting for opponent…'
      : view.prompt
        ? 'Make your choice'
        : myTurn
          ? 'Your turn'
          : "Opponent's turn";

  return (
    <div
      className={`play-mat grid min-h-full grid-cols-1 gap-3 p-3 lg:h-dvh lg:min-h-0 lg:grid-cols-[1fr_18rem] lg:gap-2 lg:overflow-hidden lg:p-2 ${phone && !view.prompt ? 'pb-24' : ''}`}
    >
      <main className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:gap-2">
        {/* On large screens only the board scrolls (when the window is too short), so the hand never leaves the screen. */}
        <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:justify-between lg:gap-2 lg:overflow-y-auto">
          <Side
            label="Opponent"
            player={opp}
            side={view.opponent}
            mirrored
            handCount={view.opponent.handCount}
            isActive={slotHasActions}
            onSlot={openSlot}
            benchSize={engine.ruleset.benchSize}
          />
          <div className="retro-box flex flex-wrap items-center justify-center gap-3 px-3 py-2 font-pixel text-[9px] uppercase">
            <span>Turn {view.turn}</span>
            <span className="border-2 border-ink bg-yellow px-2 py-1">{status}</span>
            {view.stadium && (
              <span className="flex items-center gap-2">
                Stadium: <CardView card={view.stadium.card} size="xs" />
              </span>
            )}
          </div>
          <Side
            label="You"
            player={viewer}
            side={view.you}
            isActive={slotHasActions}
            onSlot={openSlot}
            benchSize={engine.ruleset.benchSize}
          />
        </div>
        <Hand
          cards={view.you.hand}
          playable={(uid) => !view.prompt && actionsForCard(legal, uid).length > 0}
          onCard={openCard}
        />
      </main>
      <aside className="flex min-h-0 flex-col gap-3 lg:gap-2">
        <div role="complementary" aria-label="Card zoom" className="hidden justify-center lg:flex">
          <CardPreview />
        </div>
        {!phone && (
          <div className="flex flex-wrap gap-2">
            {!view.prompt &&
              globalActions(legal).map((a, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => (a.type === 'concede' ? concede() : act(a))}
                  className={
                    a.type === 'endTurn'
                      ? 'flex-1 retro-shadow border-4 border-ink bg-yellow px-4 py-2 font-pixel text-[10px] uppercase text-ink hover:brightness-105'
                      : 'border-4 border-ink bg-paper px-3 py-2 font-pixel text-[10px] uppercase text-ink hover:bg-cream'
                  }
                >
                  {describeAction(a, view)}
                </button>
              ))}
          </div>
        )}
        {/* On wide screens the log is always shown; on a phone the player can hide it to give the board room. */}
        <div className={logOpen ? 'contents' : 'hidden lg:contents'}>
          <GameLog log={view.log} me={viewer} />
        </div>
        {!phone && (
          <button
            type="button"
            onClick={quit}
            className="border-4 border-ink bg-paper px-3 py-2 font-pixel text-[10px] uppercase text-ink hover:bg-cream"
          >
            Quit to home
          </button>
        )}
      </aside>
      {phone && !view.prompt && !view.result && (
        <ActionBar
          logOpen={logOpen}
          onToggleLog={toggleLog}
          onEndTurn={legal.some((a) => a.type === 'endTurn') ? () => act({ type: 'endTurn' }) : undefined}
          onConcede={legal.some((a) => a.type === 'concede') ? concede : undefined}
          onQuit={quit}
        />
      )}
      {view.prompt && (
        <PromptPanel
          prompt={view.prompt}
          view={view}
          legal={legal}
          onAnswer={(id) => act({ type: 'answer', optionId: id })}
        />
      )}
      {menu && (
        <ActionMenu
          title={menu.title}
          actions={menu.actions}
          view={view}
          onPick={act}
          onDetails={() => {
            setDetails(menu.card);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {details && <CardDetails card={details} onClose={() => setDetails(null)} />}
    </div>
  );
}
