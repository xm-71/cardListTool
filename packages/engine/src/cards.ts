import type { EffectCtx } from './effects.ts';
import type { EnergyType, GameState, SlotRef } from './types.ts';

export interface AttackDef {
  name: string;
  cost: EnergyType[];
  damage: number;
  damageSuffix: '' | '+' | '×';
  text: string;
}

export interface AbilityDef {
  name: string;
  text: string;
}

interface CardDefBase {
  id: string;
  name: string;
  regulationMark: string | null;
  rarity: string;
  image: string;
}

export interface PokemonDef extends CardDefBase {
  category: 'Pokemon';
  stage: 'Basic' | 'Stage1' | 'Stage2';
  hp: number;
  types: EnergyType[];
  evolvesFrom: string | null;
  weakness: EnergyType | null;
  resistance: EnergyType | null;
  retreat: number;
  attacks: AttackDef[];
  abilities: AbilityDef[];
  isEx: boolean;
  isMega: boolean;
}

export interface TrainerDef extends CardDefBase {
  category: 'Trainer';
  trainerType: 'Item' | 'Supporter' | 'Stadium' | 'Tool';
  text: string;
  isAceSpec: boolean;
}

export interface EnergyDef extends CardDefBase {
  category: 'Energy';
  energyKind: 'Basic' | 'Special';
  provides: EnergyType[];
  text: string;
}

export type CardDef = PokemonDef | TrainerDef | EnergyDef;

export interface DamageQuery {
  state: GameState;
  /** The slot whose card (Pokémon or attached Tool) carries the hook being evaluated. */
  holder: SlotRef;
  attacker: SlotRef;
  defender: SlotRef;
  amount: number;
  registry: CardRegistry;
}

export interface AttackScript {
  canUse?(ctx: EffectCtx): boolean;
  damage?(ctx: EffectCtx): number | { amount: number; ignoreWR: boolean };
  effect?(ctx: EffectCtx): void;
}

export interface CardScript {
  attacks?: Record<number, AttackScript>;
  abilities?: Record<string, { canUse(ctx: EffectCtx): boolean; use(ctx: EffectCtx): void }>;
  trainer?: { canPlay?(ctx: EffectCtx): boolean; play(ctx: EffectCtx): void };
  stadium?: {
    canUse?(ctx: EffectCtx): boolean;
    use?(ctx: EffectCtx): void;
    onBenchFromHand?(ctx: EffectCtx, slot: SlotRef): void;
  };
  modifyOutgoingDamage?(q: DamageQuery): number;
  modifyIncomingDamage?(q: DamageQuery): number;
  modifyRetreatCost?(q: { state: GameState; slot: SlotRef; cost: number; registry: CardRegistry }): number;
  modifyPrizes?(q: {
    state: GameState;
    holder: SlotRef;
    holderSide: SlotRef['player'];
    knockedOut: SlotRef;
    byAttackFromEx: boolean;
    prizes: number;
    registry: CardRegistry;
  }): number;
  afterDamagedInActive?(ctx: EffectCtx, holder: SlotRef, attacker: SlotRef): void;
  /** Applied for the attacking Pokémon's own card when checking an attack's cost. */
  modifyAttackCost?(q: {
    state: GameState;
    holder: SlotRef;
    attackIndex: number;
    cost: EnergyType[];
    registry: CardRegistry;
  }): EnergyType[];
  /** Applied from the Stadium in play and the Pokémon's own card and Tool. */
  modifyMaxHp?(q: { state: GameState; slot: SlotRef; hp: number; registry: CardRegistry }): number;
  onEvolveFromHand?: { use(ctx: EffectCtx, slot: SlotRef): void };
}

export interface CardRegistry {
  defs: Record<string, CardDef>;
  scripts: Record<string, CardScript>;
}
