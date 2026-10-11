export type PlayerId = 0 | 1;

export type EnergyType =
  | 'Grass'
  | 'Fire'
  | 'Water'
  | 'Lightning'
  | 'Psychic'
  | 'Fighting'
  | 'Darkness'
  | 'Metal'
  | 'Dragon'
  | 'Colorless';

export const ENERGY_TYPES: readonly EnergyType[] = [
  'Grass',
  'Fire',
  'Water',
  'Lightning',
  'Psychic',
  'Fighting',
  'Darkness',
  'Metal',
  'Dragon',
  'Colorless',
];

export interface DeckList {
  name: string;
  cards: { id: string; count: number }[];
  note?: string;
}

export type SlotRef =
  { player: PlayerId; zone: 'active' } | { player: PlayerId; zone: 'bench'; index: number };

export interface CardInstance {
  uid: string;
  defId: string;
  owner: PlayerId;
}

export interface Conditions {
  rotation: 'none' | 'asleep' | 'confused' | 'paralyzed';
  poisoned: boolean;
  burned: boolean;
}

/** Timed effects on a Pokémon that last through the opponent's next turn (see EffectCtx.addMarker). */
export type MarkerKind =
  | 'reduceIncoming'
  | 'preventFromBasic'
  | 'reduceOutgoing'
  | 'cantRetreat'
  /** The Pokémon's attacks do `amount` more damage (before Weakness and Resistance). */
  | 'increaseOutgoing'
  /** Prevent all damage done to the Pokémon by attacks. */
  | 'preventDamage'
  /** The Pokémon's attacks cost `amount` more {C}. */
  | 'attackCostMore'
  /** The Pokémon's Retreat Cost is `amount` more. */
  | 'retreatCostMore';

export interface Marker {
  kind: MarkerKind;
  amount: number;
  /** Active while state.turn <= untilTurn. */
  untilTurn: number;
}

export interface PokemonSlot {
  /** uids; last entry is the Pokémon in play, earlier entries are what it evolved from */
  stack: string[];
  energy: string[];
  tool: string | null;
  /** damage in HP (damage counters × 10) */
  damage: number;
  conditions: Conditions;
  enteredTurn: number;
  evolvedTurn: number | null;
  abilityUsedTurn: Record<string, number>;
  cantAttackOnTurn: number | null;
  /** attack name → the turn on which it can't be used */
  attackLocks: Record<string, number>;
  /** Timed effects; they end when this Pokémon leaves the Active Spot or evolves. */
  markers: Marker[];
  /** Turn on which this Pokémon last moved from the Bench to the Active Spot. */
  becameActiveTurn: number | null;
  /** Repeatable Abilities: uses on the given turn. */
  abilityUses?: Record<string, { turn: number; count: number }>;
}

export interface PlayerState {
  deck: string[];
  hand: string[];
  discard: string[];
  prizes: string[];
  active: PokemonSlot | null;
  bench: PokemonSlot[];
  supporterTurn: number | null;
  /** The Supporter played this turn, by name (for cards that care which one). */
  supporterPlayed?: { turn: number; name: string } | null;
  energyTurn: number | null;
  retreatTurn: number | null;
  stadiumUsedTurn: number | null;
  stadiumPlayedTurn: number | null;
  /** This player can't play Stadium cards from hand during this turn (e.g. Chi-Yu). */
  stadiumLockedTurn?: number | null;
  mulligans: number;
  /** Turn on which one of this player's Pokémon was last Knocked Out. */
  lastKnockedOutTurn: number | null;
  /** Ability name → turn used, for "can't use more than 1 X Ability each turn". */
  abilityNamesUsedTurn: Record<string, number>;
}

export interface PromptOption {
  id: string;
  label: string;
  uid?: string;
  /** For card options: the card's definition id (the chooser may see it, e.g. when searching their deck). */
  defId?: string;
  slot?: SlotRef;
}

export interface Prompt {
  player: PlayerId;
  kind: 'cards' | 'slot' | 'option';
  message: string;
  options: PromptOption[];
  min: number;
  max: number;
  selected: string[];
}

export type EffectSource =
  | { kind: 'attack'; slot: SlotRef; attackIndex: number }
  | { kind: 'ability'; slot: SlotRef; ability: string }
  | { kind: 'evolve'; slot: SlotRef }
  | { kind: 'trainer'; uid: string; target?: SlotRef }
  | { kind: 'stadium' }
  | { kind: 'system'; name: 'setup' | 'promote' | 'retreatCost' };

/** What started a (possibly paused) effect: a player action, or game setup. */
export type Origin = Action | { type: 'setup' };

/** A paused effect: replaying `origin` from `snapshot` with `answers` resumes it. */
export interface PendingEffect {
  snapshot: GameState;
  origin: Origin;
  player: PlayerId;
  answers: string[];
}

export interface GameResult {
  winner: PlayerId | 'draw';
  reason: 'prizes' | 'noPokemon' | 'deckOut' | 'concede';
}

/**
 * What a log event did on the board, for the app to animate. Pokémon in play are named by the first card of
 * their stack (it stays the same through evolution and moves between Active and Bench).
 */
export type EventAnim =
  | { kind: 'attack'; by: string }
  | { kind: 'damage'; target: string; amount: number }
  | { kind: 'knockout'; target: string }
  | { kind: 'prize'; player: PlayerId; count: number }
  | { kind: 'promote'; target: string; player: PlayerId }
  | { kind: 'retreat'; from: string; to: string; player: PlayerId }
  | { kind: 'bench'; uid: string; player: PlayerId }
  | { kind: 'energy'; uid: string; target: string }
  | { kind: 'evolve'; uid: string; target: string }
  | { kind: 'trainer'; uid: string; player: PlayerId }
  | { kind: 'coin'; heads: boolean }
  | {
      kind: 'condition';
      target: string;
      condition: 'asleep' | 'confused' | 'paralyzed' | 'poisoned' | 'burned';
    }
  | {
      kind: 'checkup';
      target: string;
      condition: 'poisoned' | 'burned' | 'asleep' | 'paralyzed';
      amount?: number;
    };

export interface GameEvent {
  type: string;
  player?: PlayerId;
  text: string;
  anim?: EventAnim;
  [k: string]: unknown;
}

export interface GameState {
  cards: Record<string, CardInstance>;
  players: [PlayerState, PlayerState];
  turn: number;
  current: PlayerId;
  first: PlayerId;
  phase: 'setup' | 'main' | 'gameOver';
  stadium: { uid: string; owner: PlayerId } | null;
  prompt: Prompt | null;
  pending: PendingEffect | null;
  rng: number;
  result: GameResult | null;
  log: GameEvent[];
  /** Cards whose effects last for the rest of a turn (e.g. Premium Power Pro). */
  lingering: { defId: string; owner: PlayerId; turn: number }[];
}

export type Action =
  | { type: 'playBasic'; uid: string }
  | { type: 'evolve'; uid: string; target: SlotRef }
  | { type: 'attachEnergy'; uid: string; target: SlotRef }
  | { type: 'playTrainer'; uid: string; target?: SlotRef }
  | { type: 'useAbility'; slot: SlotRef; ability: string }
  | { type: 'useStadium' }
  | { type: 'retreat'; benchIndex: number }
  | { type: 'attack'; attackIndex: number; benchIndex?: number }
  | { type: 'endTurn' }
  | { type: 'answer'; optionId: string }
  | { type: 'concede' };
