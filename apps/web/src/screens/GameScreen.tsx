import { useEffect, useMemo, useState } from 'react';
import type { Action, CardInstance, PlayerId, SlotRef } from '@ptcg/engine';
import { actionsForCard, actionsForSlot } from '../game/actions.ts';
import { engine } from '../game/catalog.ts';
import { defaultSelection, panelModel, sameSelection, type Selection } from '../game/selection.ts';
import { actorOf, useGame } from '../game/store.ts';
import { defOf } from '../game/view.ts';
import { useNav } from '../nav/useNav.ts';
import { ActionBar } from '../ui/ActionBar.tsx';
import { CardDetails } from '../ui/CardDetails.tsx';
import { CardView } from '../ui/CardView.tsx';
import { GameLog } from '../ui/GameLog.tsx';
import { Hand } from '../ui/Hand.tsx';
import { OpponentStrip } from '../ui/OpponentStrip.tsx';
import { PromptPanel } from '../ui/PromptPanel.tsx';
import { SelectionPanel } from '../ui/SelectionPanel.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Side } from '../ui/Side.tsx';
import { useIsPhone } from '../ui/useIsPhone.ts';

interface Props {
  /** Seat whose view is shown. Defaults to the human seat (bot mode). */
  viewer?: PlayerId;
}

/** What is picked on the board, and whether the game picked it (your Active at the start of a turn). */
interface Pick {
  sel: Selection | null;
  auto: boolean;
}

export function GameScreen({ viewer: viewerProp }: Props) {
  const state = useGame((s) => s.state);
  const human = useGame((s) => s.human);
  const dispatch = useGame((s) => s.dispatch);
  const reset = useGame((s) => s.reset);
  const [details, setDetails] = useState<CardInstance | null>(null);
  const [pick, setPick] = useState<Pick>({ sel: null, auto: false });
  const [handOpen, setHandOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const viewer = viewerProp ?? human;
  const phone = useIsPhone();

  const view = useMemo(() => (state ? engine.viewFor(state, viewer) : null), [state, viewer]);
  const legal = useMemo(
    () => (state && actorOf(state) === viewer ? engine.getLegalActions(state, viewer) : []),
    [state, viewer],
  );
  const myTurn = !!view && !view.prompt && legal.length > 0;
  const turn = view?.turn;
  const hasActive = !!view?.you.active;

  // At the start of your turn your Active Pokémon is selected, so attacking is one tap away.
  useEffect(() => {
    if (myTurn)
      setPick({
        sel: hasActive ? { kind: 'slot', ref: { player: viewer, zone: 'active' } } : null,
        auto: true,
      });
  }, [turn, myTurn, viewer, hasActive]);

  const clear = () => setPick({ sel: null, auto: false });
  // Escape puts the selection down (on phones the sheet closes itself).
  useEffect(() => {
    if (phone) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPick({ sel: null, auto: false });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone]);

  if (!state || !view) return null;
  const opp: PlayerId = viewer === 0 ? 1 : 0;

  const act = (a: Action) => {
    setPick({ sel: defaultSelection(view, viewer), auto: true });
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
  // Tapping a card picks it; tapping the one picked again lets go (the first tap on your auto-picked Active opens it).
  const select = (sel: Selection) =>
    setPick((p) =>
      sameSelection(p.sel, sel)
        ? p.auto
          ? { sel, auto: false }
          : { sel: null, auto: false }
        : { sel, auto: false },
    );
  const selectSlot = (ref: SlotRef) => select({ kind: 'slot', ref });
  const selectHand = (uid: string) => {
    select({ kind: 'hand', uid });
    setHandOpen(false);
  };
  const slotHasActions = (ref: SlotRef) => !view.prompt && actionsForSlot(legal, ref, viewer).length > 0;

  const model = panelModel(view, legal, pick.sel, viewer);
  const status = view.result
    ? 'Game over'
    : view.waitingOn !== null
      ? 'Waiting for opponent…'
      : view.prompt
        ? 'Make your choice'
        : myTurn
          ? 'Your turn'
          : "Opponent's turn";
  const statusLine = `Turn ${view.turn} · ${status}`;
  const stadium = view.stadium
    ? {
        card: view.stadium.card,
        action: view.prompt ? undefined : legal.find((a) => a.type === 'useStadium'),
      }
    : undefined;
  const canEndTurn = !view.prompt && legal.some((a) => a.type === 'endTurn');
  const canConcede = !view.prompt && legal.some((a) => a.type === 'concede');
  const selectedHand = pick.sel?.kind === 'hand' ? pick.sel.uid : null;
  const playable = (uid: string) => !view.prompt && actionsForCard(legal, uid).length > 0;
  const panel = (
    <SelectionPanel
      view={view}
      status={statusLine}
      model={model}
      stadium={stadium}
      onAct={act}
      onDetails={setDetails}
    />
  );
  const side = (
    label: string,
    player: PlayerId,
    data: typeof view.you | typeof view.opponent,
    opponent: boolean,
  ) => (
    <Side
      label={label}
      player={player}
      side={data}
      mirrored={opponent}
      compact={phone}
      handCount={opponent ? view.opponent.handCount : undefined}
      isActive={slotHasActions}
      selection={pick.sel}
      onSlot={selectSlot}
      benchSize={engine.ruleset.benchSize}
    />
  );
  const overlays = (
    <>
      {view.prompt && (
        <PromptPanel
          prompt={view.prompt}
          view={view}
          legal={legal}
          onAnswer={(id) => act({ type: 'answer', optionId: id })}
        />
      )}
      {phone && boardOpen && (
        <Sheet title="Opponent's board" onClose={() => setBoardOpen(false)}>
          {side('Opponent', opp, view.opponent, true)}
        </Sheet>
      )}
      {phone && model && !pick.auto && (
        <Sheet title={defOf(model.card).name} onClose={clear} className="max-h-[55dvh]">
          {panel}
        </Sheet>
      )}
      {details && <CardDetails card={details} onClose={() => setDetails(null)} />}
    </>
  );

  if (phone) {
    return (
      <div className={`play-mat flex h-dvh flex-col gap-2 overflow-hidden p-2 ${view.prompt ? '' : 'pb-20'}`}>
        <OpponentStrip
          player={opp}
          side={view.opponent}
          selection={pick.sel}
          onSlot={selectSlot}
          onViewBoard={() => setBoardOpen(true)}
        />
        <div className="flex flex-wrap items-center justify-center gap-2 font-pixel text-[9px] uppercase">
          <span className="border-2 border-ink bg-yellow text-ink-fixed px-2 py-1">{statusLine}</span>
          {view.stadium && (
            <span className="flex items-center gap-1 normal-case">
              Stadium: <CardView card={view.stadium.card} size="xs" />
            </span>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto">
          {side('You', viewer, view.you, false)}
        </div>
        {handOpen ? (
          <Sheet title="Your hand" onClose={() => setHandOpen(false)}>
            <Hand cards={view.you.hand} playable={playable} selectedUid={selectedHand} onCard={selectHand} />
          </Sheet>
        ) : (
          <div hidden>
            <Hand cards={view.you.hand} playable={playable} selectedUid={selectedHand} onCard={selectHand} />
          </div>
        )}
        {!view.prompt && !view.result && (
          <ActionBar
            handCount={view.you.hand.length}
            onHand={() => setHandOpen(true)}
            onEndTurn={canEndTurn ? () => act({ type: 'endTurn' }) : undefined}
            onConcede={canConcede ? concede : undefined}
            onQuit={quit}
            log={<GameLog log={view.log} me={viewer} />}
          />
        )}
        {overlays}
      </div>
    );
  }

  return (
    <div className="play-mat grid min-h-full grid-cols-1 gap-3 p-3 lg:h-dvh lg:min-h-0 lg:grid-cols-[1fr_20rem] lg:gap-2 lg:overflow-hidden lg:p-2">
      <main className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:gap-2">
        {/* Only the board scrolls (when the window is too short), so the hand never leaves the screen. */}
        <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:justify-between lg:gap-2 lg:overflow-y-auto">
          {side('Opponent', opp, view.opponent, true)}
          {side('You', viewer, view.you, false)}
        </div>
        <Hand cards={view.you.hand} playable={playable} selectedUid={selectedHand} onCard={selectHand} />
      </main>
      <div className="flex min-h-0 flex-col gap-3 lg:gap-2">
        <div
          role="complementary"
          aria-label="Selection"
          className="retro-box min-h-0 shrink-0 overflow-y-auto p-3 lg:max-h-[68%]"
        >
          {panel}
        </div>
        {canEndTurn && (
          <button
            type="button"
            onClick={() => act({ type: 'endTurn' })}
            className="retro-shadow border-4 border-ink bg-yellow px-4 py-2 font-pixel text-[10px] uppercase text-ink-fixed hover:brightness-105"
          >
            End turn
          </button>
        )}
        <GameLog log={view.log} me={viewer} />
        <div className="flex gap-2">
          {canConcede && (
            <button
              type="button"
              onClick={concede}
              className="flex-1 border-4 border-ink bg-paper px-3 py-2 font-pixel text-[10px] uppercase text-ink hover:bg-cream"
            >
              Concede
            </button>
          )}
          <button
            type="button"
            onClick={quit}
            className="flex-1 border-4 border-ink bg-paper px-3 py-2 font-pixel text-[10px] uppercase text-ink hover:bg-cream"
          >
            Quit to home
          </button>
        </div>
      </div>
      {overlays}
    </div>
  );
}
