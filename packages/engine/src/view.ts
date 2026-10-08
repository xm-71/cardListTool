import type {
  CardInstance,
  Conditions,
  GameEvent,
  GameResult,
  GameState,
  PlayerId,
  PokemonSlot,
  Prompt,
} from './types.ts';

export interface SlotView {
  stack: CardInstance[];
  energy: CardInstance[];
  tool: CardInstance | null;
  damage: number;
  conditions: Conditions;
  enteredTurn: number;
  evolvedTurn: number | null;
  abilityUsedTurn: Record<string, number>;
  cantAttackOnTurn: number | null;
}

interface SideView {
  deckCount: number;
  discard: CardInstance[];
  prizeCount: number;
  active: SlotView | null;
  bench: SlotView[];
}

export interface PlayerView {
  me: PlayerId;
  turn: number;
  current: PlayerId;
  first: PlayerId;
  phase: GameState['phase'];
  stadium: { card: CardInstance; owner: PlayerId } | null;
  result: GameResult | null;
  log: GameEvent[];
  /** The prompt, only when this player is the one choosing. */
  prompt: Prompt | null;
  /** Set when the opponent is making a choice this player must wait for. */
  waitingOn: PlayerId | null;
  you: SideView & {
    hand: CardInstance[];
    supporterTurn: number | null;
    energyTurn: number | null;
    retreatTurn: number | null;
    stadiumUsedTurn: number | null;
  };
  opponent: SideView & { handCount: number };
}

/** What `player` is allowed to see of the game. */
export function viewFor(state: GameState, player: PlayerId): PlayerView {
  const card = (uid: string): CardInstance => ({ ...state.cards[uid]! });
  const slot = (s: PokemonSlot): SlotView => ({
    stack: s.stack.map(card),
    energy: s.energy.map(card),
    tool: s.tool ? card(s.tool) : null,
    damage: s.damage,
    conditions: { ...s.conditions },
    enteredTurn: s.enteredTurn,
    evolvedTurn: s.evolvedTurn,
    abilityUsedTurn: { ...s.abilityUsedTurn },
    cantAttackOnTurn: s.cantAttackOnTurn,
  });
  const side = (p: PlayerId, hideBoard: boolean): SideView => {
    const ps = state.players[p];
    return {
      deckCount: ps.deck.length,
      discard: ps.discard.map(card),
      prizeCount: ps.prizes.length,
      active: hideBoard || !ps.active ? null : slot(ps.active),
      bench: hideBoard ? [] : ps.bench.map(slot),
    };
  };
  const opp: PlayerId = player === 0 ? 1 : 0;
  const me = state.players[player];
  const prompt = state.prompt && state.prompt.player === player ? structuredClone(state.prompt) : null;
  return {
    me: player,
    turn: state.turn,
    current: state.current,
    first: state.first,
    phase: state.phase,
    stadium: state.stadium ? { card: card(state.stadium.uid), owner: state.stadium.owner } : null,
    result: state.result ? { ...state.result } : null,
    log: structuredClone(state.log),
    prompt,
    waitingOn: state.prompt && state.prompt.player !== player ? state.prompt.player : null,
    you: {
      ...side(player, false),
      hand: me.hand.map(card),
      supporterTurn: me.supporterTurn,
      energyTurn: me.energyTurn,
      retreatTurn: me.retreatTurn,
      stadiumUsedTurn: me.stadiumUsedTurn,
    },
    opponent: { ...side(opp, state.phase === 'setup'), handCount: state.players[opp].hand.length },
  };
}
