import { nextRandom, type CardDef } from '@ptcg/engine';
import { CREDITS } from './config.ts';

export const PACKS: readonly { setId: string; name: string; price: number }[] = [
  { setId: 'me01', name: 'Mega Evolution', price: CREDITS.packPrice },
  { setId: 'me02', name: 'Phantasmal Flames', price: CREDITS.packPrice },
];

/** Slot-10 (rare or better) rates. Approximations, not official. */
export const SLOT10_RATES: Readonly<Record<string, number>> = {
  Rare: 0.7,
  'Double rare': 0.18,
  'Ultra Rare': 0.07,
  'Special illustration rare': 0.03,
  'Mega Hyper Rare': 0.02,
};

/** Chance that reverse-holo slot 9 is an Illustration rare. */
export const SLOT9_ILLUSTRATION_RATE = 0.12;

const REVERSE_RARITIES = ['Common', 'Uncommon', 'Rare'];

/** Opens one 10-card pack of `setId` from that set's cards. Pure: the same rng gives the same pack. */
export function openPack(
  setId: string,
  cards: readonly CardDef[],
  rng: number,
): { cards: string[]; rng: number } {
  let r = rng;
  const random = (): number => {
    const [v, next] = nextRandom(r);
    r = next;
    return v;
  };
  const inSet = cards.filter((c) => c.id.startsWith(`${setId}-`));
  const byRarity = (...rarities: string[]): CardDef[] => inSet.filter((c) => rarities.includes(c.rarity));
  const pick = (pool: CardDef[]): string => {
    if (pool.length === 0) throw new Error(`Set ${setId} has no cards for a pack slot`);
    return pool[Math.floor(random() * pool.length)]!.id;
  };
  const rareOrBetter = (): CardDef[] => {
    let roll = random();
    for (const [rarity, rate] of Object.entries(SLOT10_RATES)) {
      if (roll < rate) {
        const pool = byRarity(rarity);
        return pool.length > 0 ? pool : byRarity('Rare');
      }
      roll -= rate;
    }
    return byRarity('Rare');
  };

  const out: string[] = [];
  for (let i = 0; i < 4; i++) out.push(pick(byRarity('Common')));
  for (let i = 0; i < 3; i++) out.push(pick(byRarity('Uncommon')));
  out.push(pick(byRarity(...REVERSE_RARITIES)));
  const illustration = byRarity('Illustration rare');
  out.push(
    random() < SLOT9_ILLUSTRATION_RATE && illustration.length > 0
      ? pick(illustration)
      : pick(byRarity(...REVERSE_RARITIES)),
  );
  out.push(pick(rareOrBetter()));
  return { cards: out, rng: r };
}
