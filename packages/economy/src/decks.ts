import type { CardDef, CardRegistry, DeckList } from '@ptcg/engine';
import { isPlayable } from '@ptcg/cards';

export const DECK_SIZE = 60;
export const MAX_COPIES = 4;
/** Oldest regulation mark legal in 2026–27 Standard. */
export const OLDEST_LEGAL_MARK = 'H';

const isBasicEnergy = (def: CardDef): boolean => def.category === 'Energy' && def.energyKind === 'Basic';

/** Readable problems with a custom deck; `[]` means it is valid. */
export function validateCustomDeck(
  deck: DeckList,
  registry: CardRegistry,
  collection: Readonly<Record<string, number>>,
): string[] {
  const problems: string[] = [];
  const total = deck.cards.reduce((n, c) => n + c.count, 0);
  if (total !== DECK_SIZE) problems.push(`Deck has ${total} cards (needs ${DECK_SIZE})`);

  const byName = new Map<string, number>();
  let aceSpecs = 0;
  let hasBasic = false;
  for (const { id, count } of deck.cards) {
    const def = registry.defs[id];
    if (!def) {
      problems.push(`Unknown card ${id}`);
      continue;
    }
    if (def.category === 'Pokemon' && def.stage === 'Basic') hasBasic = true;
    if (isBasicEnergy(def)) continue;
    byName.set(def.name, (byName.get(def.name) ?? 0) + count);
    if (def.category === 'Trainer' && def.isAceSpec) aceSpecs += count;
    if (def.regulationMark === null || def.regulationMark < OLDEST_LEGAL_MARK) {
      problems.push(`${def.name} (${def.regulationMark ?? 'no mark'}) is not legal in Standard`);
    }
    if (!isPlayable(def, registry)) problems.push(`${def.name} isn't playable yet`);
    const own = collection[id] ?? 0;
    if (own < count) problems.push(`You own ${own} ${def.name} but the deck uses ${count}`);
  }
  for (const [name, count] of byName)
    if (count > MAX_COPIES) problems.push(`More than ${MAX_COPIES} ${name}`);
  if (!hasBasic) problems.push('No Basic Pokémon');
  if (aceSpecs > 1) problems.push('More than 1 ACE SPEC');
  return problems;
}
