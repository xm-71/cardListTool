import type { CardDef } from './cards.ts';

export interface Ruleset {
  id: string;
  deckSize: number;
  handSize: number;
  prizeCount: number;
  benchSize: number;
  firstPlayerCanAttackTurn1: boolean;
  firstPlayerCanPlaySupporterTurn1: boolean;
  prizeValue(def: CardDef): number;
}

export const standard2026: Ruleset = {
  id: 'standard-2026-27',
  deckSize: 60,
  handSize: 7,
  prizeCount: 6,
  benchSize: 5,
  firstPlayerCanAttackTurn1: false,
  firstPlayerCanPlaySupporterTurn1: false,
  prizeValue(def) {
    if (def.category !== 'Pokemon') return 1;
    return def.isMega ? 3 : def.isEx ? 2 : 1;
  },
};
