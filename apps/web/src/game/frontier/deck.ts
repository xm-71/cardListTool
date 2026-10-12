import { isAceSpec, type CardDef, type CardRegistry } from '@ptcg/engine';
import { deckRuleProblems } from '@ptcg/economy';

/** A run deck's contents. */
export type RunCards = { id: string; count: number }[];

const MAX_COPIES = 4;
/** autoCut leaves at least this much basic Energy while other cards can be cut. */
const MIN_ENERGY = 10;

/** Problems with a run deck under the Frontier's deck rules; `[]` means it is legal. */
export const runDeckProblems = (cards: RunCards, registry: CardRegistry): string[] =>
  deckRuleProblems({ name: 'Frontier run deck', cards }, registry);

/** `cards` plus `add` minus `cut`, keeping the original order and dropping cards that reach zero. */
export function applyChange(cards: RunCards, add: RunCards, cut: RunCards): RunCards {
  const counts = new Map<string, number>();
  for (const c of [...cards, ...add]) counts.set(c.id, (counts.get(c.id) ?? 0) + c.count);
  for (const c of cut) counts.set(c.id, (counts.get(c.id) ?? 0) - c.count);
  return [...counts].filter(([, n]) => n > 0).map(([id, count]) => ({ id, count }));
}

const isBasicEnergy = (d: CardDef) => d.category === 'Energy' && d.energyKind === 'Basic';
const isAce = (d: CardDef) => isAceSpec(d);
const isBasicPokemon = (d: CardDef) => d.category === 'Pokemon' && d.stage === 'Basic';

/**
 * A legal cut of `n` cards from `cards` + `add`, or null. It removes, in order of preference: copies that break a rule,
 * basic Energy above 10, Trainers, Evolution Pokémon, Basic Pokémon (never the last one), then any basic Energy; the
 * added cards come last, and with `keepAdded` they are never cut.
 */
export function autoCut(
  cards: RunCards,
  add: RunCards,
  n: number,
  registry: CardRegistry,
  keepAdded = false,
): RunCards | null {
  const counts = new Map(applyChange(cards, add, []).map((c) => [c.id, c.count]));
  const added = new Set(add.map((c) => c.id));
  const def = (id: string) => registry.defs[id]!;
  const live = (skip: (id: string) => boolean, test: (d: CardDef) => boolean) =>
    [...counts]
      .filter(([id, k]) => k > 0 && !skip(id) && test(def(id)))
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

  const pick = (skip: (id: string) => boolean): string | undefined => {
    const byName = new Map<string, number>();
    let aces = 0;
    for (const [id, k] of counts) {
      const d = def(id);
      if (!isBasicEnergy(d)) byName.set(d.name, (byName.get(d.name) ?? 0) + k);
      if (isAce(d)) aces += k;
    }
    const breaking = (d: CardDef) =>
      (!isBasicEnergy(d) && (byName.get(d.name) ?? 0) > MAX_COPIES) || (aces > 1 && isAce(d));
    // Rule-breaking copies come first, from any card the cut may touch.
    const fix = live((id) => keepAdded && added.has(id), breaking)[0];
    if (fix) return fix;
    const total = (test: (d: CardDef) => boolean) =>
      [...counts].reduce((sum, [id, k]) => sum + (test(def(id)) ? k : 0), 0);
    const basics = total(isBasicPokemon);
    // Basic Energy goes first only while plenty is left; a deck needs Energy to attack.
    return (
      (total(isBasicEnergy) > MIN_ENERGY ? live(skip, isBasicEnergy)[0] : undefined) ??
      live(skip, (d) => d.category === 'Trainer')[0] ??
      live(skip, (d) => d.category === 'Pokemon' && d.stage !== 'Basic')[0] ??
      (basics > 1 ? live(skip, isBasicPokemon)[0] : undefined) ??
      live(skip, isBasicEnergy)[0]
    );
  };

  const cut = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const id = pick((x) => added.has(x)) ?? (keepAdded ? undefined : pick(() => false));
    if (!id) return null;
    counts.set(id, counts.get(id)! - 1);
    cut.set(id, (cut.get(id) ?? 0) + 1);
  }
  const result = [...cut].map(([id, count]) => ({ id, count }));
  return runDeckProblems(applyChange(cards, add, result), registry).length === 0 ? result : null;
}
