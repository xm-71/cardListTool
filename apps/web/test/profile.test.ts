import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { CREDITS } from '@ptcg/economy';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { openIndexedDbStore } from '../src/profile/indexedDbStore.ts';
import { connectProfileStore, useProfile } from '../src/profile/useProfile.ts';
import { newProfile, type Profile, type ProfileStore } from '../src/profile/types.ts';

const total = (c: Record<string, number>): number => Object.values(c).reduce((a, b) => a + b, 0);

/** A memory store that counts saves and remembers the last saved profile. */
function spyStore(initial?: Profile): ProfileStore & { saved: Profile[] } {
  const inner = createMemoryStore(initial);
  const saved: Profile[] = [];
  return {
    saved,
    load: () => inner.load(),
    async save(p) {
      saved.push(structuredClone(p));
      await inner.save(p);
    },
  };
}

beforeEach(() => useProfile.getState().reset());

test('a new profile starts with 500 credits and nothing else', () => {
  expect(newProfile()).toEqual({
    version: 1,
    credits: CREDITS.start,
    collection: {},
    decks: [],
    awardedGames: [],
  });
});

test('the IndexedDB store round-trips a profile', async () => {
  const store = await openIndexedDbStore(`test-${Math.random()}`);
  expect(await store.load()).toEqual(newProfile());
  const p: Profile = { ...newProfile(), credits: 42, collection: { 'me01-001': 2 } };
  await store.save(p);
  expect(await store.load()).toEqual(p);
});

test('falls back to an in-memory profile when IndexedDB cannot be opened', async () => {
  const { store, persistent } = await connectProfileStore(() => Promise.reject(new Error('private mode')));
  expect(persistent).toBe(false);
  expect(await store.load()).toEqual(newProfile());
});

test('init loads the stored profile', async () => {
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), credits: 900 }), true);
  expect(useProfile.getState().profile.credits).toBe(900);
  expect(useProfile.getState().persistent).toBe(true);
});

describe('award', () => {
  test('(RF1) awarding the same game twice adds once', async () => {
    const store = spyStore();
    await useProfile.getState().init(store, true);
    await useProfile.getState().award(1234, 100);
    await useProfile.getState().award(1234, 100);
    expect(useProfile.getState().profile.credits).toBe(600);
    expect((await store.load()).credits).toBe(600);
  });

  test('keeps only the last 200 awarded games', async () => {
    await useProfile.getState().init(createMemoryStore(), true);
    for (let seed = 0; seed < 205; seed++) await useProfile.getState().award(seed, 1);
    const { awardedGames } = useProfile.getState().profile;
    expect(awardedGames).toHaveLength(200);
    expect(awardedGames[0]).toBe(5);
  });
});

describe('buyPack', () => {
  test('(RF2) without enough credits it rejects and changes nothing', async () => {
    const store = spyStore({ ...newProfile(), credits: 100 });
    await useProfile.getState().init(store, true);
    await expect(useProfile.getState().buyPack('me01')).rejects.toThrow(/credits/i);
    expect(useProfile.getState().profile).toEqual({ ...newProfile(), credits: 100 });
    expect(store.saved).toHaveLength(0);
  });

  test('(RF3) subtracts 150 and saves the 10 cards before resolving', async () => {
    const store = spyStore();
    await useProfile.getState().init(store, true);
    const cards = await useProfile.getState().buyPack('me02');
    expect(cards).toHaveLength(10);
    const saved = await store.load();
    expect(saved.credits).toBe(350);
    expect(total(saved.collection)).toBe(10);
    for (const id of cards) expect(saved.collection[id]).toBeGreaterThan(0);
    expect(useProfile.getState().profile).toEqual(saved);
  });

  test('two quick buys with credits for one only buy once', async () => {
    await useProfile.getState().init(createMemoryStore({ ...newProfile(), credits: 200 }), true);
    const results = await Promise.allSettled([
      useProfile.getState().buyPack('me01'),
      useProfile.getState().buyPack('me01'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(useProfile.getState().profile.credits).toBe(50);
  });
});

test('saveDeck adds or replaces by id and deleteDeck removes', async () => {
  const store = spyStore();
  await useProfile.getState().init(store, true);
  await useProfile.getState().saveDeck({ id: 'd1', name: 'One', cards: [] });
  await useProfile.getState().saveDeck({ id: 'd1', name: 'Renamed', cards: [] });
  expect((await store.load()).decks).toEqual([{ id: 'd1', name: 'Renamed', cards: [] }]);
  await useProfile.getState().deleteDeck('d1');
  expect((await store.load()).decks).toEqual([]);
});
