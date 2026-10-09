/**
 * Balance check: Easy-vs-Easy games for every ordered pair of different decks; prints each deck's win rate.
 * Usage: npx tsx scripts/round-robin.ts [gamesPerPair=40]
 *        npx tsx scripts/round-robin.ts --gym [gamesPerPair=20]   (each Gym deck vs the 9 decks, both seats)
 */
import { createEngine, type DeckList } from '@ptcg/engine';
import * as cards from '@ptcg/cards';
import { createEasyBot } from '../src/easy.ts';
import { createMediumBot } from '../src/medium.ts';
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
const args = process.argv.slice(2);
const gym = args.includes('--gym');
/** With --medium the Gym deck is piloted by the Medium bot (as in the game for gyms 5–8, Elite Four and Champion). */
const medium = args.includes('--medium');
const numeric = args.filter((a) => !a.startsWith('--'));

/** Spec §6 win-rate targets (percent) for each Gym deck against the starter and theme decks. */
const GYM_TARGETS: Record<string, [number, number]> = {
  brock: [30, 50],
  surge: [30, 50],
  misty: [30, 50],
  erika: [30, 50],
  koga: [40, 60],
  sabrina: [40, 60],
  blaine: [40, 60],
  giovanni: [40, 60],
  lorelei: [45, 65],
  bruno: [45, 65],
  agatha: [45, 65],
  lance: [45, 65],
  'blue-fire': [45, 65],
  'blue-water': [45, 65],
  'blue-grass': [45, 65],
};

/** The first four gyms are piloted by the Easy bot in the game; every other Gym deck by the Medium bot. */
const EASY_PILOTED = new Set(['brock', 'surge', 'misty', 'erika']);

if (gym) {
  const games = Number(numeric[0] ?? 20);
  let gymSeed = 1;
  const only = process.env.GYM_ONLY?.split(',');
  for (const [id, deck] of Object.entries(cards.GYM_DECKS)) {
    if (only && !only.includes(id)) continue;
    let wins = 0;
    let played = 0;
    for (const [, opp] of DECKS)
      for (let g = 0; g < games; g++) {
        const seat = g % 2; // alternate seats
        const decks = (seat === 0 ? [deck, opp] : [opp, deck]) as [DeckList, DeckList];
        const gymBot =
          medium && !EASY_PILOTED.has(id) ? createMediumBot(registry, decks, seat as 0 | 1) : bot;
        const bots = (seat === 0 ? [gymBot, bot] : [bot, gymBot]) as [typeof bot, typeof bot];
        const r = runMatch({ engine, decks, seed: gymSeed++, bots });
        played++;
        if (r.result?.winner === seat) wins++;
      }
    const pct = (100 * wins) / played;
    const [lo, hi] = GYM_TARGETS[id]!;
    console.log(
      `${id.padEnd(11)} ${pct.toFixed(1).padStart(5)}%  (${wins}/${played})  target ${lo}–${hi}%${pct < lo || pct > hi ? '  <-- OUT OF RANGE' : ''}`,
    );
  }
  process.exit(0);
}

const perPair = Number(numeric[0] ?? 40);
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
