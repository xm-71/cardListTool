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
}

export interface PlayerState {
  deck: string[];
  hand: string[];
  discard: string[];
  prizes: string[];
  active: PokemonSlot | null;
  bench: PokemonSlot[];
  supporterTurn: number | null;
  energyTurn: number | null;
  retreatTurn: number | null;
  stadiumUsedTurn: number | null;
  mulligans: number;
}

export interface PromptOption {
  id: string;
  label: string;
  uid?: string;
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

export interface GameEvent {
  type: string;
  player?: PlayerId;
  text: string;
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
}

export type Action =
  | { type: 'playBasic'; uid: string }
  | { type: 'evolve'; uid: string; target: SlotRef }
  | { type: 'attachEnergy'; uid: string; target: SlotRef }
  | { type: 'playTrainer'; uid: string; target?: SlotRef }
  | { type: 'useAbility'; slot: SlotRef; ability: string }
  | { type: 'useStadium' }
  | { type: 'retreat'; benchIndex: number }
  | { type: 'attack'; attackIndex: number }
  | { type: 'endTurn' }
  | { type: 'answer'; optionId: string }
  | { type: 'concede' };
