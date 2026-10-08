import type {
  Marker,
  CardInstance,
  Conditions,
  GameEvent,
  GameResult,
  GameState,
  PlayerId,
  PokemonSlot,
  Prompt,
  SlotRef,
} from './types.ts';
import type { Env } from './env.ts';
import { maxHp } from './state.ts';

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
  attackLocks: Record<string, number>;
  markers: Marker[];
  becameActiveTurn: number | null;
  abilityUses?: Record<string, { turn: number; count: number }>;
  /** Effective max HP (after Stadium/Tool modifiers), when the view was built with card data. */
  hp?: number;
}

interface SideView {
  /** Public: the turn on which one of this player's Pokémon was last Knocked Out. */
  lastKnockedOutTurn: number | null;
  /** Public: the turn on which this player can't play Stadium cards. */
  stadiumLockedTurn: number | null;
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
  /** Public "this turn" effects in play. */
  lingering: GameState['lingering'];
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
    stadiumPlayedTurn: number | null;
    abilityNamesUsedTurn: Record<string, number>;
    mulligans: number;
  };
  opponent: SideView & { handCount: number };
}

/** What `player` is allowed to see of the game. */
export function viewFor(state: GameState, player: PlayerId, env?: Env): PlayerView {
  const card = (uid: string): CardInstance => ({ ...state.cards[uid]! });
  const slot = (s: PokemonSlot, ref: SlotRef): SlotView => ({
    stack: s.stack.map(card),
    energy: s.energy.map(card),
    tool: s.tool ? card(s.tool) : null,
    damage: s.damage,
    conditions: { ...s.conditions },
    enteredTurn: s.enteredTurn,
    evolvedTurn: s.evolvedTurn,
    abilityUsedTurn: { ...s.abilityUsedTurn },
    cantAttackOnTurn: s.cantAttackOnTurn,
    attackLocks: { ...(s.attackLocks ?? {}) },
    markers: (s.markers ?? []).map((m) => ({ ...m })),
    becameActiveTurn: s.becameActiveTurn ?? null,
    ...(s.abilityUses ? { abilityUses: structuredClone(s.abilityUses) } : {}),
    ...(env ? { hp: maxHp(env, state, ref) } : {}),
  });
  const side = (p: PlayerId, hideBoard: boolean): SideView => {
    const ps = state.players[p];
    return {
      lastKnockedOutTurn: ps.lastKnockedOutTurn ?? null,
      stadiumLockedTurn: ps.stadiumLockedTurn ?? null,
      deckCount: ps.deck.length,
      discard: ps.discard.map(card),
      prizeCount: ps.prizes.length,
      active: hideBoard || !ps.active ? null : slot(ps.active, { player: p, zone: 'active' }),
      bench: hideBoard ? [] : ps.bench.map((b, index) => slot(b, { player: p, zone: 'bench', index })),
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
    lingering: structuredClone(state.lingering ?? []),
    prompt,
    waitingOn: state.prompt && state.prompt.player !== player ? state.prompt.player : null,
    you: {
      ...side(player, false),
      hand: me.hand.map(card),
      supporterTurn: me.supporterTurn,
      energyTurn: me.energyTurn,
      retreatTurn: me.retreatTurn,
      stadiumUsedTurn: me.stadiumUsedTurn,
      stadiumPlayedTurn: me.stadiumPlayedTurn ?? null,
      abilityNamesUsedTurn: { ...(me.abilityNamesUsedTurn ?? {}) },
      mulligans: me.mulligans,
    },
    opponent: { ...side(opp, state.phase === 'setup'), handCount: state.players[opp].hand.length },
  };
}
