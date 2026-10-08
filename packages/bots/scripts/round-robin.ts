/**
 * Balance check: Easy-vs-Easy games for every ordered pair of different decks; prints each deck's win rate.
 * Usage: npx tsx scripts/round-robin.ts [gamesPerPair=40]
 */
import { createEngine, type DeckList } from '@ptcg/engine';
import * as cards from '@ptcg/cards';
import { createEasyBot } from '../src/easy.ts';
import { runMatch } from '../src/runMatch.ts';

const registry = cards.buildRegistry();
const engine = createEngine(registry);
const bot = createEasyBot(registry);
const DECKS: [string, DeckList][] = [
  ['Mega Gengar ex', cards.megaGengarDeck],
  ['Mega Diancie ex', cards.megaDiancieDeck],
  ['Mega Lucario ex', cards.megaLucarioDeck],
  ['Mega Charizard X ex', cards.megaCharizardXDeck],
  ['Mega Venusaur ex', cards.megaVenusaurDeck],
  ['Mega Abomasnow ex', cards.megaAbomasnowDeck],
  ['Mega Manectric ex', cards.megaManectricDeck],
  ['Mega Kangaskhan ex', cards.megaKangaskhanDeck],
  ['Mega Lopunny ex', cards.megaLopunnyDeck],
];
const perPair = Number(process.argv[2] ?? 40);
const record = new Map(DECKS.map(([n]) => [n, { wins: 0, games: 0 }]));
let seed = 1;
for (const [n0, d0] of DECKS)
  for (const [n1, d1] of DECKS) {
    if (n0 === n1) continue;
    for (let g = 0; g < perPair; g++) {
      const r = runMatch({ engine, decks: [d0, d1], seed: seed++, bots: [bot, bot] });
      record.get(n0)!.games++;
      record.get(n1)!.games++;
      if (r.result?.winner === 0) record.get(n0)!.wins++;
      else if (r.result?.winner === 1) record.get(n1)!.wins++;
    }
  }
const rows = [...record].sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games);
for (const [name, { wins, games }] of rows) {
  const pct = (100 * wins) / games;
  console.log(
    `${name.padEnd(20)} ${pct.toFixed(1).padStart(5)}%  (${wins}/${games})${pct < 30 || pct > 70 ? '  <-- outside 30–70%' : ''}`,
  );
}
