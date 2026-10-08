import type { CardDef, CardRegistry, CardScript } from '@ptcg/engine';
import cards from './data/cards.json';
import { scriptModules } from './scripts/index.ts';

export function buildRegistry(): CardRegistry {
  const defs = cards as Record<string, CardDef>;
  const byName = new Map<string, CardScript>(scriptModules.map((m) => [m.name, m.script]));
  const scripts: Record<string, CardScript> = {};
  for (const def of Object.values(defs)) {
    const script = byName.get(def.name);
    if (script) scripts[def.id] = script;
  }
  return { defs, scripts };
}
