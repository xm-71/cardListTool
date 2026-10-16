import type { CardDef, CardRegistry, CardScript, PokemonDef } from '@ptcg/engine';
import cards from './data/cards.json';
import { scriptModules } from './scripts/index.ts';
import { GYM_SET } from './gym.ts';

/** What a Pokémon does: its attacks and Abilities, the text a script has to implement. */
const behaviour = (d: PokemonDef): string =>
  JSON.stringify({
    attacks: d.attacks.map((a) => [a.name, a.cost, a.damage, a.damageSuffix, a.text]),
    abilities: d.abilities.map((a) => [a.name, a.text]),
  });

export function buildRegistry(): CardRegistry {
  const defs = cards as Record<string, CardDef>;
  const byName = new Map<string, { id: string; script: CardScript }>();
  const bySetAndName = new Map<string, CardScript>();
  for (const m of scriptModules) {
    if (m.set) bySetAndName.set(`${m.set}:${m.name}`, m.script);
    else byName.set(m.name, { id: m.id, script: m.script });
  }
  /**
   * A script written without `set` serves every card of that name. Trainers and Energy share one by reprint; a
   * Pokémon only borrows it when its attacks and Abilities are those of the card the script was written for, since
   * different Pokémon cards often share a name.
   */
  const borrowed = (def: CardDef): CardScript | undefined => {
    const found = byName.get(def.name);
    if (!found) return undefined;
    if (def.category !== 'Pokemon' || found.id === def.id) return found.script;
    const source = defs[found.id];
    return source?.category === 'Pokemon' && behaviour(source) === behaviour(def) ? found.script : undefined;
  };
  const scripts: Record<string, CardScript> = {};
  for (const def of Object.values(defs)) {
    const set = def.id.slice(0, def.id.lastIndexOf('-'));
    // A 151 Pokémon never borrows an older card's script that happens to share its name.
    const own =
      bySetAndName.get(`${set}:${def.name}`) ??
      (set === GYM_SET && def.category === 'Pokemon' ? undefined : borrowed(def));
    if (own) scripts[def.id] = own;
  }
  return { defs, scripts };
}
