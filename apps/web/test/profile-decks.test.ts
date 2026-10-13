import { CREDITS } from '@ptcg/economy';
import { beforeEach, describe, expect, test } from 'vitest';
import { DECKS } from '../src/game/catalog.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';

const total = (c: Record<string, number>): number => Object.values(c).reduce((a, b) => a + b, 0);
const theme = DECKS.find((d) => d.kind === 'theme')!;
const price = CREDITS.deckPrices.theme;
const state = () => useProfile.getState().profile;

async function launch(p: Partial<Profile> = {}) {
  const store = createMemoryStore({ ...newProfile(), introDone: true, ...p });
  await useProfile.getState().init(store, true);
  return store;
}

beforeEach(() => useProfile.getState().reset());

describe('the intro', () => {
  test('finishing it owns the chosen starter and adds its cards', async () => {
    await useProfile.getState().init(createMemoryStore(), true);
    await useProfile.getState().finishIntro('ASH', 'mega-lucario');
    expect(state().ownedDecks).toEqual(['mega-lucario']);
    expect(total(state().collection)).toBe(60);
  });

  test('skipping the deck choice owns Mega Gengar', async () => {
    await useProfile.getState().init(createMemoryStore(), true);
    await useProfile.getState().finishIntro('ASH', undefined);
    expect(state().ownedDecks).toEqual(['mega-gengar']);
    expect(total(state().collection)).toBe(60);
  });
});

describe('replaying the intro', () => {
  test('changes the default deck but grants nothing new', async () => {
    await launch({ ownedDecks: ['mega-gengar'], starterDeck: 'mega-gengar', collection: { x: 1 } });
    await useProfile.getState().finishIntro('ASH', 'mega-lucario');
    expect(state().starterDeck).toBe('mega-lucario');
    expect(state().ownedDecks).toEqual(['mega-gengar']);
    expect(state().collection).toEqual({ x: 1 });
  });
});

describe('buyDeck', () => {
  test('a theme deck costs 600, is owned afterwards and adds its 60 cards, saved', async () => {
    const store = await launch({ credits: 1000 });
    const before = total(state().collection);
    await useProfile.getState().buyDeck(theme.id);
    expect(state().credits).toBe(1000 - price);
    expect(state().ownedDecks).toContain(theme.id);
    expect(total(state().collection)).toBe(before + 60);
    const saved = await store.load();
    expect(saved.ownedDecks).toContain(theme.id);
    expect(saved.credits).toBe(1000 - price);
  });

  test('buying the same deck twice fails and charges once', async () => {
    await launch({ credits: 2000 });
    await useProfile.getState().buyDeck(theme.id);
    await expect(useProfile.getState().buyDeck(theme.id)).rejects.toThrow('Already owned');
    expect(state().credits).toBe(2000 - price);
  });

  test('two presses at once charge once', async () => {
    await launch({ credits: 2000 });
    const results = await Promise.allSettled([
      useProfile.getState().buyDeck(theme.id),
      useProfile.getState().buyDeck(theme.id),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(state().credits).toBe(2000 - price);
  });

  test('without enough credits it fails and changes nothing', async () => {
    await launch({ credits: price - 1 });
    const before = state();
    await expect(useProfile.getState().buyDeck(theme.id)).rejects.toThrow('Not enough credits');
    expect(state()).toEqual(before);
  });

  test('Collector mode does not sell decks', async () => {
    await launch({ credits: 5000, collectorMode: true });
    await expect(useProfile.getState().buyDeck(theme.id)).rejects.toThrow(
      'Decks are not sold in Collector mode',
    );
    expect(state().credits).toBe(5000);
  });
});
