/**
 * Balance check: Easy-vs-Easy games for every ordered pair of different decks; prints each deck's win rate.
 * Usage: npx tsx scripts/round-robin.ts [gamesPerPair=40]
 *        npx tsx scripts/round-robin.ts --gym [gamesPerPair=20]   (each Gym deck vs the 9 decks, both seats)
 *        npx tsx scripts/round-robin.ts --hard [gamesPerPair=4]   (Hard vs Medium on every ordered deck pair)
 *        npx tsx scripts/round-robin.ts --smart [gamesPerPair=4]  (smart Hard vs legacy Hard on every ordered deck pair)
 *        npx tsx scripts/round-robin.ts --probe [gamesPerSeat=1]  (each leader deck, with its in-game bot, vs 9 Hard-piloted decks)
 */
import { createEngine, type DeckList } from '@ptcg/engine';
import * as cards from '@ptcg/cards';
import { createEasyBot } from '../src/easy.ts';
import { createHardBot } from '../src/hard.ts';
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
  ['Dragapult ex', cards.metaDragapultDeck],
  ['Alakazam', cards.metaAlakazamDeck],
  ['Ogerpon Box', cards.metaOgerponBoxDeck],
  ["N's Zoroark ex", cards.metaNsZoroarkDeck],
  ['Slowking', cards.metaSlowkingDeck],
  ['Crustle', cards.metaCrustleDeck],
];
const args = process.argv.slice(2);
const gym = args.includes('--gym');
const hardMode = args.includes('--hard');
const smartMode = args.includes('--smart');
const probeMode = args.includes('--probe');
/** With --medium the Gym deck is piloted by the Medium bot (as in the game for gyms 5–8, Elite Four and Champion). */
const medium = args.includes('--medium');
const numeric = args.filter((a) => !a.startsWith('--'));

/** The bot each leader uses in the game (copied from apps/web/src/game/gym.ts). */
const LEADER_DIFFICULTY: Record<string, 'easy' | 'medium' | 'hard'> = {
  brock: 'easy',
  misty: 'easy',
  surge: 'easy',
  erika: 'easy',
  koga: 'medium',
  sabrina: 'medium',
  blaine: 'medium',
  giovanni: 'medium',
  lorelei: 'medium',
  bruno: 'medium',
  agatha: 'medium',
  lance: 'medium',
  'blue-fire': 'medium',
  'blue-water': 'medium',
  'blue-grass': 'medium',
  falkner: 'medium',
  bugsy: 'medium',
  whitney: 'hard',
  morty: 'hard',
  chuck: 'hard',
  jasmine: 'hard',
  pryce: 'hard',
  clair: 'hard',
  will: 'hard',
  'johto-koga': 'hard',
  'johto-bruno': 'hard',
  karen: 'hard',
  'johto-lance': 'hard',
  red: 'hard',
};

/** Win-rate bands (percent) for the leaders with meta decks, from the meta-decks spec. Later PRs add theirs. */
const PROBE_TARGETS: Record<string, [number, number]> = {
  lorelei: [55, 65],
  bruno: [55, 65],
  agatha: [55, 65],
  lance: [55, 65],
};

if (probeMode) {
  // Each leader deck, played by the bot it has in the game, against the 6 meta and 3 Mega premade decks piloted by
  // the Hard bot. GYM_ONLY=a,b limits the leaders; HARD_SHARD=k/n splits them; HARD_ROUNDS sets Hard's search rounds.
  const perSeat = Number(numeric[0] ?? 1);
  const rounds = Number(process.env.HARD_ROUNDS ?? 8);
  const [shard, shards] = (process.env.HARD_SHARD ?? '0/1').split('/').map(Number) as [number, number];
  const only = process.env.GYM_ONLY?.split(',');
  const opponents = DECKS.slice(9).concat(
    DECKS.filter(([n]) => ['Mega Gengar ex', 'Mega Lucario ex', 'Mega Charizard X ex'].includes(n)),
  );
  const ids = Object.keys(cards.GYM_DECKS)
    .filter((id) => !only || only.includes(id))
    .filter((_, i) => i % shards === shard);
  let seed = 1 + shard * 100000;
  let totalWins = 0;
  let totalGames = 0;
  for (const id of ids) {
    const leaderDeck = (cards.GYM_DECKS as Record<string, DeckList>)[id]!;
    const difficulty = LEADER_DIFFICULTY[id] ?? 'medium';
    let wins = 0;
    let games = 0;
    const turns: number[] = [];
    for (const [, opp] of opponents)
      for (const leaderSeat of [0, 1] as const)
        for (let g = 0; g < perSeat; g++) {
          const decks = (leaderSeat === 0 ? [leaderDeck, opp] : [opp, leaderDeck]) as [DeckList, DeckList];
          const options = { maxRounds: rounds, now: () => 0 };
          const leaderBot =
            difficulty === 'easy'
              ? createEasyBot(registry)
              : difficulty === 'medium'
                ? createMediumBot(registry, decks, leaderSeat)
                : createHardBot(registry, decks, leaderSeat, options);
          const oppBot = createHardBot(registry, decks, (1 - leaderSeat) as 0 | 1, options);
          const bots = (leaderSeat === 0 ? [leaderBot, oppBot] : [oppBot, leaderBot]) as [
            typeof bot,
            typeof bot,
          ];
          const r = runMatch({ engine, decks, seed: seed++, bots });
          games++;
          turns.push(r.turns);
          if (r.result?.winner === leaderSeat) wins++;
        }
    const pct = (100 * wins) / games;
    const median = [...turns].sort((a, b) => a - b)[Math.floor(turns.length / 2)] ?? 0;
    const band = PROBE_TARGETS[id];
    const verdict = band ? (pct >= band[0] && pct <= band[1] ? 'PASS' : 'FAIL') : '';
    console.log(
      `${id.padEnd(12)} ${difficulty.padEnd(6)} win ${pct.toFixed(0).padStart(3)}%  medTurns ${median}  band ${band ? `${band[0]}-${band[1]}` : '-'} ${verdict}`.trimEnd(),
    );
    totalWins += wins;
    totalGames += games;
  }
  console.log(`TALLY ${totalWins} ${totalGames}`);
  process.exit(0);
}

if (hardMode) {
  const perPair = Number(numeric[0] ?? 4);
  const WIN_TARGET = 50; // accepted bar: clearly above Medium (first target was 60%)
  const P95_TARGET_MS = 2000;
  const byDeck = new Map(DECKS.map(([n]) => [n, { wins: 0, games: 0 }]));
  let hardWins = 0;
  let played = 0;
  let hardSeed = 1 + Number((process.env.HARD_SHARD ?? '0/1').split('/')[0]) * 100000;
  const play = (d0: DeckList, d1: DeckList, hardSeat: 0 | 1, hard: ReturnType<typeof createHardBot>) => {
    const decks: [DeckList, DeckList] = [d0, d1];
    const medium = createMediumBot(registry, decks, (1 - hardSeat) as 0 | 1);
    const bots = (hardSeat === 0 ? [hard, medium] : [medium, hard]) as [typeof bot, typeof bot];
    return runMatch({ engine, decks, seed: hardSeed++, bots });
  };
  // HARD_SHARD=k/n runs every n-th first deck, so shards can run in parallel and be summed.
  const [shard, shards] = (process.env.HARD_SHARD ?? '0/1').split('/').map(Number) as [number, number];
  for (const [i0, [n0, d0]] of DECKS.entries())
    for (const [n1, d1] of DECKS) {
      if (i0 % shards !== shard) continue;
      for (let g = 0; g < perPair; g++) {
        const hardSeat = (g % 2) as 0 | 1;
        const decks: [DeckList, DeckList] = [d0, d1];
        // Fixed rounds and a frozen clock keep the win-rate run reproducible.
        const hard = createHardBot(registry, decks, hardSeat, {
          maxRounds: Number(process.env.HARD_ROUNDS ?? 16),
          now: () => 0,
        });
        const r = play(d0, d1, hardSeat, hard);
        const mine = byDeck.get(hardSeat === 0 ? n0 : n1)!;
        mine.games++;
        played++;
        if (r.result?.winner === hardSeat) {
          hardWins++;
          mine.wins++;
        }
      }
    }
  const pct = (100 * hardWins) / played;
  for (const [name, { wins, games }] of byDeck)
    console.log(
      `${name.padEnd(20)} Hard ${((100 * wins) / Math.max(1, games)).toFixed(1).padStart(5)}%  (${wins}/${games})`,
    );
  console.log(
    `Hard vs Medium: ${pct.toFixed(1)}% (${hardWins}/${played})  target > ${WIN_TARGET}%  ${pct > WIN_TARGET ? 'PASS' : 'FAIL'}`,
  );

  console.log(`TALLY ${hardWins} ${played}`);
  // Think time with the real clock and default options (first shard only).
  if (shard !== 0) process.exit(0);
  const times: number[] = [];
  for (let g = 0; g < 6; g++) {
    const [, d0] = DECKS[(g * 2) % DECKS.length]!;
    const [, d1] = DECKS[(g * 2 + 1) % DECKS.length]!;
    const hardSeat = (g % 2) as 0 | 1;
    const real = createHardBot(registry, [d0, d1], hardSeat);
    const timed: typeof real = (v, l, rng) => {
      const t = performance.now();
      const out = real(v, l, rng);
      times.push(performance.now() - t);
      return out;
    };
    play(d0, d1, hardSeat, timed);
  }
  const searched = times.filter((t) => t > 5).sort((a, b) => a - b);
  const q = (f: number) => searched[Math.min(searched.length - 1, Math.floor(f * searched.length))] ?? 0;
  console.log(
    `Hard think time over ${searched.length} searched decisions: median ${q(0.5).toFixed(0)} ms, p95 ${q(0.95).toFixed(0)} ms  target <= ${P95_TARGET_MS} ms  ${q(0.95) <= P95_TARGET_MS ? 'PASS' : 'FAIL'}`,
  );
  process.exit(0);
}

if (smartMode) {
  // The smart policy against today's Hard (Easy rollouts and the old scoring, kept as `legacy`), same decks both ways.
  const perPair = Number(numeric[0] ?? 4);
  const WIN_TARGET = 60;
  const rounds = Number(process.env.HARD_ROUNDS ?? 8);
  const [shard, shards] = (process.env.HARD_SHARD ?? '0/1').split('/').map(Number) as [number, number];
  const byDeck = new Map(DECKS.map(([n]) => [n, { wins: 0, games: 0 }]));
  let wins = 0;
  let played = 0;
  let seed = 1 + shard * 100000;
  for (const [i0, [n0, d0]] of DECKS.entries())
    for (const [n1, d1] of DECKS) {
      if (i0 % shards !== shard) continue;
      for (let g = 0; g < perPair; g++) {
        const smartSeat = (g % 2) as 0 | 1;
        const decks: [DeckList, DeckList] = [d0, d1];
        const opts = { maxRounds: rounds, now: () => 0 };
        const smart = createHardBot(registry, decks, smartSeat, opts);
        const legacy = createHardBot(registry, decks, (1 - smartSeat) as 0 | 1, { ...opts, legacy: true });
        const bots = (smartSeat === 0 ? [smart, legacy] : [legacy, smart]) as [typeof bot, typeof bot];
        const r = runMatch({ engine, decks, seed: seed++, bots });
        const mine = byDeck.get(smartSeat === 0 ? n0 : n1)!;
        mine.games++;
        played++;
        if (r.result?.winner === smartSeat) {
          wins++;
          mine.wins++;
        }
      }
    }
  for (const [name, { wins: w, games }] of byDeck)
    console.log(
      `${name.padEnd(20)} smart ${((100 * w) / Math.max(1, games)).toFixed(1).padStart(5)}%  (${w}/${games})`,
    );
  const pct = (100 * wins) / Math.max(1, played);
  console.log(
    `Smart Hard vs legacy Hard: ${pct.toFixed(1)}% (${wins}/${played})  target >= ${WIN_TARGET}%  ${pct >= WIN_TARGET ? 'PASS' : 'FAIL'}`,
  );
  console.log(`TALLY ${wins} ${played}`);
  process.exit(0);
}

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
  // Johto's Whitney and Morty use the Hard bot in the game but are measured here with the Medium bot, so their
  // in-game win rate is higher than measured: the bands sit at the lower end.
  whitney: [40, 60],
  morty: [40, 60],
  falkner: [40, 60],
  bugsy: [45, 65],
  chuck: [40, 60],
  jasmine: [40, 60],
  pryce: [40, 60],
  clair: [40, 60],
  will: [40, 60],
  'johto-koga': [40, 60],
  'johto-bruno': [40, 60],
  karen: [40, 60],
  'johto-lance': [45, 65],
  red: [45, 65],
};

/**
 * The first four Kanto gyms are piloted by the Easy bot in the game; every other Gym deck by the Medium bot (the
 * balance run also uses Medium for Johto's Hard-piloted Whitney and Morty: Hard is too slow for a bulk run).
 */
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
