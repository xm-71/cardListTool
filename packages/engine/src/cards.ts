import type { EffectCtx } from './effects.ts';
import type { EnergyType, GameState, SlotRef } from './types.ts';

export interface AttackDef {
  name: string;
  cost: EnergyType[];
  damage: number;
  damageSuffix: '' | '+' | '×' | '-' | '?';
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
  damage?(
    ctx: EffectCtx,
  ):
    | number
    | { amount: number; ignoreWR: boolean; ignoreResistance?: boolean; ignoreDefenderEffects?: boolean };
  effect?(ctx: EffectCtx): void;
}

export interface CardScript {
  attacks?: Record<number, AttackScript>;
  abilities?: Record<
    string,
    {
      canUse(ctx: EffectCtx): boolean;
      use(ctx: EffectCtx): void;
      /** "As often as you like during your turn" (capped at REPEATABLE_CAP). */
      repeatable?: boolean;
    }
  >;
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
  onEvolveFromHand?: {
    /** When true the Ability isn't optional: it runs without asking ("you must ..."). */
    mandatory?: boolean;
    use(ctx: EffectCtx, slot: SlotRef): void;
  };
  /**
   * Called when damage from an attack would Knock this Pokémon Out (not Poison, Burn or damage it did to
   * itself); return true to have it survive with 10 HP left.
   */
  survivesKnockout?(ctx: EffectCtx, holder: SlotRef): boolean;
  /**
   * After an attack Knocks a Pokémon Out, called for each Pokémon its owner has in play (the Knocked Out one
   * included) while they are still in play, before Prizes are taken.
   */
  afterKnockout?(ctx: EffectCtx, e: { holder: SlotRef; knocked: SlotRef; attacker: SlotRef }): void;
  /** Applied to every Pokémon in play of the holder's owner (e.g. Dragonite's "no Retreat Cost"). */
  modifyAllRetreatCosts?(q: {
    state: GameState;
    holder: SlotRef;
    slot: SlotRef;
    cost: number;
    registry: CardRegistry;
  }): number;
}

export interface CardRegistry {
  defs: Record<string, CardDef>;
  scripts: Record<string, CardScript>;
}
