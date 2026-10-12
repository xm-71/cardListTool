import type { CardDef, CardRegistry, DeckList, PokemonDef } from '@ptcg/engine';
import { GYM_DECKS, isPlayable } from '@ptcg/cards';
import { DECKS, registry as catalogRegistry } from '../catalog.ts';

/** How strong a package is; later Frontier fights favour higher tiers. */
export type Tier = 'plain' | 'ex' | 'ace';

/** A few cards that go together, offered as one Frontier reward. */
export interface FrontierPackage {
  /** Stable: the cards as sorted "id*count", joined by "+". */
  id: string;
  kind: 'line' | 'trainers' | 'energy';
  tier: Tier;
  cards: { id: string; count: number }[];
}

type Entry = { id: string; count: number; def: CardDef };

/** Packages built from the cards that appear together in the given decks (see the Frontier plan, Task 1). */
export function buildPool(decks: readonly DeckList[], registry: CardRegistry): FrontierPackage[] {
  const out = new Map<string, FrontierPackage>();
  const add = (kind: FrontierPackage['kind'], cards: { id: string; count: number }[]) => {
    const defs = cards.map((c) => registry.defs[c.id]!);
    if (cards.some((c) => c.count < 1) || defs.some((d) => !isPlayable(d, registry))) return;
    const tier: Tier = defs.some((d) => d.category === 'Trainer' && d.isAceSpec)
      ? 'ace'
      : defs.some((d) => d.category === 'Pokemon' && (d.isEx || d.isMega))
        ? 'ex'
        : 'plain';
    const id = cards
      .map((c) => `${c.id}*${c.count}`)
      .sort()
      .join('+');
    if (!out.has(id)) out.set(id, { id, kind, tier, cards });
  };

  for (const deck of decks) {
    const entries: Entry[] = deck.cards.flatMap((c) => {
      const def = registry.defs[c.id];
      return def ? [{ id: c.id, count: c.count, def }] : [];
    });
    const pokemon = entries.filter((e) => e.def.category === 'Pokemon');
    const named = (name: string) => pokemon.find((e) => e.def.name === name);
    const evolvedFrom = new Set(pokemon.map((e) => (e.def as PokemonDef).evolvesFrom).filter(Boolean));

    for (const top of pokemon) {
      if (evolvedFrom.has(top.def.name)) continue; // not a top-stage card
      const chain: Entry[] = [top];
      for (let e = top; (e.def as PokemonDef).evolvesFrom;) {
        const parent = named((e.def as PokemonDef).evolvesFrom!);
        if (!parent) break;
        chain.unshift(parent);
        e = parent;
      }
      const [basic, stage1, stage2] = chain;
      if ((basic!.def as PokemonDef).stage !== 'Basic') continue; // a line missing its Basic
      if (chain.length === 1) {
        if (basic!.count >= 2) add('line', [{ id: basic!.id, count: 2 }]);
      } else if (chain.length === 2) {
        add('line', [
          { id: basic!.id, count: Math.min(basic!.count, 2) },
          { id: stage1!.id, count: Math.min(stage1!.count, 2) },
        ]);
      } else {
        add('line', [
          { id: basic!.id, count: Math.min(basic!.count, 2) },
          { id: stage1!.id, count: 1 },
          { id: stage2!.id, count: 1 },
        ]);
      }
    }
    for (const e of entries) {
      if (e.def.category === 'Trainer') {
        if (e.def.isAceSpec) add('trainers', [{ id: e.id, count: 1 }]);
        else if (e.count >= 2) add('trainers', [{ id: e.id, count: 2 }]);
      } else if (e.def.category === 'Energy' && e.def.energyKind === 'Special' && e.count >= 2) {
        add('energy', [{ id: e.id, count: 2 }]);
      }
    }
  }
  return [...out.values()];
}

let cached: FrontierPackage[] | null = null;

/** The pool built from every built-in deck (starter, theme, meta and Gym), computed once. */
export const frontierPool = (): FrontierPackage[] =>
  (cached ??= buildPool([...DECKS.map((d) => d.list), ...Object.values(GYM_DECKS)], catalogRegistry));
