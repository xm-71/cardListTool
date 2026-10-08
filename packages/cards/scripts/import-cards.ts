// Fetches every card of the sets in src/sets.json plus every card referenced by a decklist
// from TCGdex and writes src/data/cards.json (set logos go to src/data/sets.json).
// Usage: pnpm --filter @ptcg/cards import-cards
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CardDef, DeckList } from '@ptcg/engine';
import { normalizeTcgdexCard } from '../src/normalize.ts';

const root = join(import.meta.dirname, '..');
const API = 'https://api.tcgdex.net/v2/en';

async function get(path: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}/${path}`);
    if (res.ok) return res.json();
    if (attempt >= 5 || (res.status !== 429 && res.status < 500)) throw new Error(`TCGdex ${path}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

const ids = new Set<string>();
const deckDir = join(root, 'src/decks');
for (const file of readdirSync(deckDir).filter((f) => f.endsWith('.json'))) {
  const deck = JSON.parse(readFileSync(join(deckDir, file), 'utf8')) as DeckList;
  for (const c of deck.cards) ids.add(c.id);
}

const setIds = JSON.parse(readFileSync(join(root, 'src/sets.json'), 'utf8')) as string[];
const setInfo: { id: string; name: string; logo: string }[] = [];
for (const setId of setIds) {
  const set = (await get(`sets/${setId}`)) as { id: string; name: string; logo?: string; cards: { id: string }[] };
  setInfo.push({ id: set.id, name: set.name, logo: set.logo ?? '' });
  for (const c of set.cards) ids.add(c.id);
}

const out: Record<string, CardDef> = {};
for (const id of [...ids].sort()) {
  out[id] = normalizeTcgdexCard(await get(`cards/${id}`));
  console.log(`${id} ${out[id].name}`);
}
writeFileSync(join(root, 'src/data/cards.json'), JSON.stringify(out, null, 2) + '\n');
writeFileSync(join(root, 'src/data/sets.json'), JSON.stringify(setInfo, null, 2) + '\n');
console.log(`Wrote ${Object.keys(out).length} cards`);
