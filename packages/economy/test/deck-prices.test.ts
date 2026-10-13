import { expect, test } from 'vitest';
import { CREDITS, deckPrice } from '../src/index.ts';

test('premade decks cost 300 (starter), 600 (theme) and 1,200 (meta)', () => {
  expect(deckPrice('starter')).toBe(300);
  expect(deckPrice('theme')).toBe(600);
  expect(deckPrice('meta')).toBe(1200);
  expect(CREDITS.deckPrices).toEqual({ starter: 300, theme: 600, meta: 1200 });
});
