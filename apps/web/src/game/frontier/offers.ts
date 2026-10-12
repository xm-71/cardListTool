import { nextRandom, type CardRegistry } from '@ptcg/engine';
import { autoCut, type RunCards } from './deck.ts';
import type { FrontierPackage, Tier } from './pool.ts';

/** One of the 3 choices after a win. */
export type Offer = { kind: 'package'; pkg: FrontierPackage } | { kind: 'tuneup' };

/** A Tune-up is offered after fights 2, 4 and 6 (0-based index of the fight just won: 1, 3, 5). */
export const hasTuneup = (fightJustWon: number): boolean =>
  fightJustWon === 1 || fightJustWon === 3 || fightJustWon === 5;

/** Tier odds (percent) by the 0-based index of the fight just won. */
const ODDS: { upTo: number; odds: Record<Tier, number> }[] = [
  { upTo: 1, odds: { plain: 80, ex: 20, ace: 0 } },
  { upTo: 4, odds: { plain: 55, ex: 40, ace: 5 } },
  { upTo: Infinity, odds: { plain: 35, ex: 55, ace: 10 } },
];
/** When no package of a tier fits, the next tier down is tried (plain falls back to ex). */
const FALLBACK: Record<Tier, Tier[]> = {
  ace: ['ace', 'ex', 'plain'],
  ex: ['ex', 'plain'],
  plain: ['plain', 'ex'],
};

const size = (cards: RunCards) => cards.reduce((n, c) => n + c.count, 0);

let memo: { key: string; pool: FrontierPackage[]; keep: FrontierPackage[] } | null = null;
/** Packages that can be taken without cutting any of their own cards. */
function keepable(deck: RunCards, pool: FrontierPackage[], registry: CardRegistry): FrontierPackage[] {
  const key = JSON.stringify(deck);
  if (memo?.key === key && memo.pool === pool) return memo.keep;
  const keep = pool.filter((p) => autoCut(deck, p.cards, size(p.cards), registry, true) !== null);
  memo = { key, pool, keep };
  return keep;
}

/** The 3 offers after winning fight `fight` (0-based), the same every time for the same seed, fight and deck. */
export function offersFor(
  o: { seed: number; fight: number; deck: RunCards },
  pool: FrontierPackage[],
  registry: CardRegistry,
): Offer[] {
  let rng = (o.seed ^ Math.imul(o.fight + 1, 0x9e3779b1)) >>> 0;
  const rand = () => {
    const [v, next] = nextRandom(rng);
    rng = next;
    return v;
  };
  const odds = ODDS.find((b) => o.fight <= b.upTo)!.odds;
  const candidates = keepable(o.deck, pool, registry);
  const tuneup = hasTuneup(o.fight);
  const chosen: FrontierPackage[] = [];
  while (chosen.length < (tuneup ? 2 : 3)) {
    const roll = rand() * 100;
    const tier: Tier = roll < odds.plain ? 'plain' : roll < odds.plain + odds.ex ? 'ex' : 'ace';
    let picked: FrontierPackage | undefined;
    for (const t of FALLBACK[tier]) {
      const left = candidates.filter((p) => p.tier === t && !chosen.includes(p));
      if (left.length) {
        picked = left[Math.floor(rand() * left.length)];
        break;
      }
    }
    if (!picked) break; // nothing left to offer at all
    chosen.push(picked);
  }
  const offers: Offer[] = chosen.map((pkg) => ({ kind: 'package', pkg }));
  if (tuneup) offers.splice(Math.floor(rand() * (offers.length + 1)), 0, { kind: 'tuneup' });
  return offers;
}
