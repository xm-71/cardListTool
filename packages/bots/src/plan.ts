import type { CardRegistry, DeckList, PokemonDef } from '@ptcg/engine';
import { DECK_PLANS } from './plans.ts';
import { isSupportPokemon } from './roles.ts';

export interface DeckPlan {
  /** Card names of the main attackers (0–2), best first. */
  attackers: string[];
  /** Each final-stage name → its line from Basic to final, by name (e.g. Dreepy, Drakloak, Dragapult ex). */
  lines: Record<string, string[]>;
  /** Names of support Pokémon. */
  support: string[];
  /** Names in search priority order: attacker lines (Basic first), support, then everything else. */
  priority: string[];
}

/** What a deck is trying to do, worked out from its own cards. */
export function deckPlan(deck: DeckList, registry: CardRegistry): DeckPlan {
  const byName = new Map<string, PokemonDef>();
  for (const { id } of deck.cards) {
    const d = registry.defs[id];
    if (d?.category === 'Pokemon' && !byName.has(d.name)) byName.set(d.name, d);
  }
  const pokemon = [...byName.values()];
  const evolvesInto = new Set(pokemon.map((p) => p.evolvesFrom).filter((n): n is string => !!n));

  // A line runs from a Basic up to a card nothing in the deck evolves from.
  const lines: Record<string, string[]> = {};
  for (const final of pokemon.filter((p) => !evolvesInto.has(p.name))) {
    const line = [final.name];
    for (let cur = final; cur.evolvesFrom; ) {
      const prev = byName.get(cur.evolvesFrom);
      if (!prev) break;
      line.unshift(prev.name);
      cur = prev;
    }
    lines[final.name] = line;
  }

  const score = (p: PokemonDef) =>
    Math.max(0, ...p.attacks.map((a) => a.damage / Math.max(1, a.cost.length)));
  const ranked = Object.keys(lines)
    .map((name) => ({ name, score: score(byName.get(name)!) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const attackers =
    ranked.length > 1 && ranked[1]!.score >= ranked[0]!.score / 2
      ? ranked.slice(0, 2).map((x) => x.name)
      : ranked.slice(0, 1).map((x) => x.name);
  const override = DECK_PLANS[deck.name];
  const finalAttackers = override?.attackers ?? attackers;
  // Support Pokémon outside the attacker lines (line members are already first in the search priority).
  const inLines = new Set(finalAttackers.flatMap((a) => lines[a] ?? [a]));
  const support = pokemon.filter((p) => isSupportPokemon(p) && !inLines.has(p.name)).map((p) => p.name);
  const finalSupport = override?.support ?? support;
  const priority: string[] = [];
  const add = (n: string) => {
    if (!priority.includes(n)) priority.push(n);
  };
  override?.first?.forEach(add);
  for (const a of finalAttackers) (lines[a] ?? [a]).forEach(add);
  finalSupport.forEach(add);
  pokemon.forEach((p) => add(p.name));
  return { attackers: finalAttackers, lines, support: finalSupport, priority };
}
