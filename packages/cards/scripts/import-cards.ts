// Fetches every card referenced by a decklist from TCGdex and writes src/data/cards.json.
// Usage: pnpm --filter @ptcg/cards import-cards
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CardDef, DeckList } from '@ptcg/engine';
import { normalizeTcgdexCard } from '../src/normalize.ts';

const root = join(import.meta.dirname, '..');
const deckDir = join(root, 'src/decks');
const ids = new Set<string>();
for (const file of readdirSync(deckDir).filter((f) => f.endsWith('.json'))) {
  const deck = JSON.parse(readFileSync(join(deckDir, file), 'utf8')) as DeckList;
  for (const c of deck.cards) ids.add(c.id);
}

const out: Record<string, CardDef> = {};
for (const id of [...ids].sort()) {
  const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${id}`);
  if (!res.ok) throw new Error(`TCGdex ${id}: HTTP ${res.status}`);
  out[id] = normalizeTcgdexCard(await res.json());
  console.log(`${id} ${out[id].name}`);
}
writeFileSync(join(root, 'src/data/cards.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote ${Object.keys(out).length} cards`);
