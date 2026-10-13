import { beforeEach, describe, expect, test } from 'vitest';
import { deckById } from '../src/game/catalog.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, normalizeProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';

const state = () => useProfile.getState().profile;
const cards = deckById('mega-gengar').list.cards.map((c) => ({ ...c }));

async function launch(p: Partial<Profile> = {}) {
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), introDone: true, ...p }), true);
}
beforeEach(() => useProfile.getState().reset());

describe('setActiveDeck', () => {
  test('saves an owned premade deck and an existing custom deck', async () => {
    await launch({
      ownedDecks: ['mega-gengar', 'mega-lucario'],
      starterDeck: 'mega-gengar',
      decks: [{ id: 'a', name: 'A', cards }],
    });
    await useProfile.getState().setActiveDeck('mega-lucario');
    expect(state().activeDeck).toBe('mega-lucario');
    await useProfile.getState().setActiveDeck('custom:a');
    expect(state().activeDeck).toBe('custom:a');
  });
  test('ignores unknown, unowned and missing ids', async () => {
    await launch({ ownedDecks: ['mega-gengar'], starterDeck: 'mega-gengar', activeDeck: 'mega-gengar' });
    for (const id of ['nope', 'mega-lucario', 'custom:missing']) {
      await useProfile.getState().setActiveDeck(id);
      expect(state().activeDeck).toBe('mega-gengar');
    }
  });
});

describe('the intro', () => {
  test('the first intro makes the starter the active deck', async () => {
    await useProfile.getState().init(createMemoryStore(), true);
    await useProfile.getState().finishIntro('ASH', 'mega-lucario');
    expect(state().activeDeck).toBe('mega-lucario');
    expect(state().starterDeck).toBe('mega-lucario');
  });
  test('replaying it leaves the active deck alone', async () => {
    await launch({
      ownedDecks: ['mega-gengar', 'mega-lucario'],
      starterDeck: 'mega-gengar',
      activeDeck: 'mega-gengar',
    });
    await useProfile.getState().finishIntro('ASH', 'mega-lucario');
    expect(state().starterDeck).toBe('mega-lucario');
    expect(state().activeDeck).toBe('mega-gengar');
  });
});

test('a save without activeDeck loads as null', () => {
  expect(normalizeProfile({ version: 1 }).activeDeck).toBeNull();
  expect(normalizeProfile({ version: 1, activeDeck: 5 as unknown as string }).activeDeck).toBeNull();
});
