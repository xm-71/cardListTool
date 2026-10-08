export type Tier = 'common' | 'rare' | 'ultra' | 'special';

const TIERS: Record<string, Tier> = {
  Common: 'common',
  Uncommon: 'common',
  Rare: 'rare',
  'Double rare': 'ultra',
  'Ultra Rare': 'ultra',
  'Illustration rare': 'special',
  'Special illustration rare': 'special',
  'Mega Hyper Rare': 'special',
};

/** How big a reveal a card's rarity gets. Unknown rarities reveal quietly. */
export function rarityTier(rarity: string): Tier {
  return TIERS[rarity] ?? 'common';
}

/** The pop-up tag for a reveal, or null for none. */
export const TAG: Record<Tier, (rarity: string) => string | null> = {
  common: () => null,
  rare: () => 'RARE!',
  ultra: (r) => `${r.toUpperCase()}!`,
  special: (r) => `${r.toUpperCase()}!`,
};
