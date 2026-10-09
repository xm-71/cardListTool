import { nextRandom, type CardDef } from '@ptcg/engine';
import { CREDITS } from './config.ts';

export type PackEra = 'mega' | 'sv' | 'classic' | 'ecard' | 'ex' | 'dp' | 'pt' | 'hgss';

export interface PackDef {
  setId: string;
  name: string;
  price: number;
  /**
   * 'mega': 10-card modern slots. 'sv': the same 10 slots with Scarlet & Violet rarities.
   * The older eras open the slots of their LAYOUTS entry.
   */
  era: PackEra;
}

/** Credits per pack: the older the set, the cheaper the pack. */
export const PACK_PRICES: Readonly<Record<PackEra, number>> = {
  mega: CREDITS.packPrice,
  sv: CREDITS.packPrice,
  classic: 100,
  ecard: 110,
  ex: 120,
  dp: 130,
  pt: 130,
  hgss: 140,
};

/** Cards drawn uniformly from the set's cards of these rarities. */
interface FixedSlot {
  count: number;
  rarities: readonly string[];
}

/** One card whose rarity is rolled from `weights` (cumulative over the entries in order), then drawn uniformly. */
interface WeightedSlot {
  weights: Readonly<Record<string, number>>;
}

type Slot = FixedSlot | WeightedSlot;

/** e-Card and EX boosters: 9 cards, with a reverse-holo slot (any non-holo rarity) before the rare. */
const NINE_CARD: readonly Slot[] = [
  { count: 4, rarities: ['Common'] },
  { count: 3, rarities: ['Uncommon'] },
  { count: 1, rarities: ['Common', 'Uncommon', 'Rare'] },
  { weights: { Rare: 0.67, 'Holo Rare': 0.33 } },
];
/** Diamond & Pearl, Platinum and HeartGold SoulSilver boosters: 10 cards with a reverse-holo slot before the rare slot. */
const tenCard = (rare: Readonly<Record<string, number>>): readonly Slot[] => [
  { count: 5, rarities: ['Common'] },
  { count: 3, rarities: ['Uncommon'] },
  { count: 1, rarities: ['Common', 'Uncommon', 'Rare'] },
  { weights: rare },
];

/** Pack contents per older era, one table row each. Pure data: the opener below just walks the slots. */
const LAYOUTS: Partial<Record<PackEra, readonly Slot[]>> = {
  // WotC boosters: 7 commons, 3 uncommons, 1 rare (any Rare or Holo Rare card, uniformly).
  classic: [
    { count: 7, rarities: ['Common'] },
    { count: 3, rarities: ['Uncommon'] },
    { count: 1, rarities: ['Rare', 'Holo Rare'] },
  ],
  ecard: NINE_CARD,
  ex: NINE_CARD,
  dp: tenCard({ Rare: 0.65, 'Rare Holo': 0.27, 'Rare Holo LV.X': 0.08 }),
  pt: tenCard({ Rare: 0.65, 'Holo Rare': 0.27, 'Rare Holo LV.X': 0.08 }),
  hgss: tenCard({ Rare: 0.6, 'Holo Rare': 0.25, 'Rare PRIME': 0.09, LEGEND: 0.05, 'Ultra Rare': 0.01 }),
};

/** Every rarity some slot of the era can produce (a card of any other rarity could never be pulled). */
export function layoutRarities(era: PackEra): string[] {
  const out = new Set<string>();
  const slots = LAYOUTS[era];
  if (!slots) {
    const rates = era === 'sv' ? SV_SLOT10_RATES : SLOT10_RATES;
    for (const r of [...REVERSE_RARITIES, 'Illustration rare', 'Common', 'Uncommon', ...Object.keys(rates)])
      out.add(r);
  }
  for (const slot of slots ?? []) {
    for (const r of 'rarities' in slot ? slot.rarities : Object.keys(slot.weights)) out.add(r);
  }
  return [...out];
}

const pack = (setId: string, name: string, era: PackEra): PackDef => ({
  setId,
  name,
  price: PACK_PRICES[era],
  era,
});

export const PACKS: readonly PackDef[] = [
  pack('me01', 'Mega Evolution', 'mega'),
  pack('me02', 'Phantasmal Flames', 'mega'),
  pack('base1', 'Base Set', 'classic'),
  pack('base2', 'Jungle', 'classic'),
  pack('base3', 'Fossil', 'classic'),
  pack('base4', 'Base Set 2', 'classic'),
  pack('base5', 'Team Rocket', 'classic'),
  pack('gym1', 'Gym Heroes', 'classic'),
  pack('gym2', 'Gym Challenge', 'classic'),
  pack('neo1', 'Neo Genesis', 'classic'),
  pack('neo2', 'Neo Discovery', 'classic'),
  pack('neo3', 'Neo Revelation', 'classic'),
  pack('neo4', 'Neo Destiny', 'classic'),
  pack('lc', 'Legendary Collection', 'classic'),
  pack('ecard1', 'Expedition Base Set', 'ecard'),
  pack('ecard2', 'Aquapolis', 'ecard'),
  pack('ecard3', 'Skyridge', 'ecard'),
  pack('ex1', 'Ruby & Sapphire', 'ex'),
  pack('ex2', 'Sandstorm', 'ex'),
  pack('ex3', 'Dragon', 'ex'),
  pack('ex4', 'Team Magma vs Team Aqua', 'ex'),
  pack('ex5', 'Hidden Legends', 'ex'),
  pack('ex6', 'FireRed & LeafGreen', 'ex'),
  pack('ex7', 'Team Rocket Returns', 'ex'),
  pack('ex8', 'Deoxys', 'ex'),
  pack('ex9', 'Emerald', 'ex'),
  pack('ex10', 'Unseen Forces', 'ex'),
  pack('ex11', 'Delta Species', 'ex'),
  pack('ex12', 'Legend Maker', 'ex'),
  pack('ex13', 'Holon Phantoms', 'ex'),
  pack('ex14', 'Crystal Guardians', 'ex'),
  pack('ex15', 'Dragon Frontiers', 'ex'),
  pack('ex16', 'Power Keepers', 'ex'),
  ...[
    'Diamond & Pearl',
    'Mysterious Treasures',
    'Secret Wonders',
    'Great Encounters',
    'Majestic Dawn',
    'Legends Awakened',
    'Stormfront',
  ].map((name, i) => pack(`dp${i + 1}`, name, 'dp')),
  ...['Platinum', 'Rising Rivals', 'Supreme Victors', 'Arceus'].map((name, i) =>
    pack(`pl${i + 1}`, name, 'pt'),
  ),
  ...['HeartGold SoulSilver', 'Unleashed', 'Undaunted', 'Triumphant'].map((name, i) =>
    pack(`hgss${i + 1}`, name, 'hgss'),
  ),
  pack('col1', 'Call of Legends', 'hgss'),
  pack('sv03.5', 'Scarlet & Violet 151', 'sv'),
];

/** How many cards a pack of `setId` opens. */
export function packSize(setId: string): number {
  const layout = LAYOUTS[PACKS.find((p) => p.setId === setId)?.era ?? 'mega'];
  return layout?.reduce((n, slot) => n + ('count' in slot ? slot.count : 1), 0) ?? 10;
}

/** The price of one pack of `setId` (the modern price for a set that is not on sale). */
export function packPrice(setId: string): number {
  return PACKS.find((p) => p.setId === setId)?.price ?? CREDITS.packPrice;
}

/** Slot-10 (rare or better) rates. Approximations, not official. */
export const SLOT10_RATES: Readonly<Record<string, number>> = {
  Rare: 0.7,
  'Double rare': 0.18,
  'Ultra Rare': 0.07,
  'Special illustration rare': 0.03,
  'Mega Hyper Rare': 0.02,
};

/** Slot-10 rates for Scarlet & Violet packs (which have Hyper rare, not Mega Hyper Rare). Approximations. */
export const SV_SLOT10_RATES: Readonly<Record<string, number>> = {
  Rare: 0.55,
  'Double rare': 0.2,
  'Ultra Rare': 0.12,
  'Special illustration rare': 0.07,
  'Hyper rare': 0.06,
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
  const rates = PACKS.find((p) => p.setId === setId)?.era === 'sv' ? SV_SLOT10_RATES : SLOT10_RATES;
  const rareOrBetter = (): CardDef[] => {
    let roll = random();
    for (const [rarity, rate] of Object.entries(rates)) {
      if (roll < rate) {
        const pool = byRarity(rarity);
        return pool.length > 0 ? pool : byRarity('Rare');
      }
      roll -= rate;
    }
    return byRarity('Rare');
  };

  const out: string[] = [];
  const layout = LAYOUTS[PACKS.find((p) => p.setId === setId)?.era ?? 'mega'];
  if (layout) {
    for (const slot of layout) {
      if ('rarities' in slot) {
        for (let i = 0; i < slot.count; i++) out.push(pick(byRarity(...slot.rarities)));
        continue;
      }
      // A rarity the set lacks is left out and the others share its chance.
      const present = Object.entries(slot.weights).filter(([rarity]) => byRarity(rarity).length > 0);
      const total = present.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = random() * total;
      let chosen = present.at(-1)![0];
      for (const [rarity, weight] of present) {
        if (roll < weight) {
          chosen = rarity;
          break;
        }
        roll -= weight;
      }
      out.push(pick(byRarity(chosen)));
    }
    return { cards: out, rng: r };
  }
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
