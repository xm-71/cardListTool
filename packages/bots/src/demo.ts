// Prints a full Easy-bot vs Easy-bot game. Usage: pnpm --filter @ptcg/bots demo -- --seed 7
import { createEngine } from '@ptcg/engine';
import { buildRegistry, megaDiancieDeck, megaGengarDeck } from '@ptcg/cards';
import { createEasyBot } from './easy.ts';
import { runMatch } from './runMatch.ts';

const seedArg = process.argv.indexOf('--seed');
const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 7;
const registry = buildRegistry();
const engine = createEngine(registry);
const bot = createEasyBot(registry);
const r = runMatch({ engine, decks: [megaGengarDeck, megaDiancieDeck], seed, bots: [bot, bot] });
for (const e of r.final.log) console.log(e.text);
console.log(`\nResult: ${JSON.stringify(r.result)} after ${r.turns} turns / ${r.actions} actions`);
console.log('Player 1: Mega Gengar ex deck · Player 2: Mega Diancie ex deck');
if (r.violations.length) console.log('VIOLATIONS', r.violations);
