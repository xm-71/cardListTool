import type { CardDef, CardRegistry, CardScript } from '@ptcg/engine';
import cards from './data/cards.json';
import { scriptModules } from './scripts/index.ts';
import { GYM_SET } from './gym.ts';

export function buildRegistry(): CardRegistry {
  const defs = cards as Record<string, CardDef>;
  const byName = new Map<string, CardScript>();
  const bySetAndName = new Map<string, CardScript>();
  for (const m of scriptModules) {
    if (m.set) bySetAndName.set(`${m.set}:${m.name}`, m.script);
    else byName.set(m.name, m.script);
  }
  const scripts: Record<string, CardScript> = {};
  for (const def of Object.values(defs)) {
    const set = def.id.slice(0, def.id.lastIndexOf('-'));
    // A 151 Pokémon never borrows an older card's script that happens to share its name.
    const own =
      bySetAndName.get(`${set}:${def.name}`) ??
      (set === GYM_SET && def.category === 'Pokemon' ? undefined : byName.get(def.name));
    if (own) scripts[def.id] = own;
  }
  return { defs, scripts };
}
