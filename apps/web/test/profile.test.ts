import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { CREDITS } from '@ptcg/economy';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { openIndexedDbStore } from '../src/profile/indexedDbStore.ts';
import { connectProfileStore, useProfile } from '../src/profile/useProfile.ts';
import { MAX_BINDERS, addPage, newBinder, placeCard } from '../src/profile/binders.ts';
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
    playerName: null,
    starterDeck: null,
    introDone: false,
    binders: [],
    collectorMode: false,
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

describe('review fixes', () => {
  test('a change made in another tab is not overwritten by this tab', async () => {
    const store = createMemoryStore();
    await useProfile.getState().init(store, true);
    // another tab buys something: the stored profile moves on without this tab knowing
    await store.save({ ...newProfile(), credits: 900, collection: { 'me01-001': 1 } });
    await useProfile.getState().award(55, 100);
    expect(await store.load()).toMatchObject({ credits: 1000, collection: { 'me01-001': 1 } });
    expect(useProfile.getState().profile.credits).toBe(1000);
  });

  test('changes requested before the profile has loaded wait for it', async () => {
    const buying = useProfile.getState().buyPack('me01');
    const store = createMemoryStore({ ...newProfile(), credits: 100 });
    await useProfile.getState().init(store, true);
    await expect(buying).rejects.toThrow(/credits/i);
    expect((await store.load()).credits).toBe(100);
  });

  test('an award before the profile has loaded lands in the real profile', async () => {
    const awarding = useProfile.getState().award(9, 100);
    const store = createMemoryStore({ ...newProfile(), credits: 20 });
    await useProfile.getState().init(store, true);
    await awarding;
    expect((await store.load()).credits).toBe(120);
    expect(useProfile.getState().profile.credits).toBe(120);
  });

  test('a failed save rejects and leaves the shown profile unchanged', async () => {
    const store: ProfileStore = {
      load: () => Promise.resolve(newProfile()),
      save: () => Promise.reject(new Error('quota exceeded')),
    };
    await useProfile.getState().init(store, true);
    await expect(useProfile.getState().buyPack('me01')).rejects.toThrow('quota exceeded');
    expect(useProfile.getState().profile).toEqual(newProfile());
  });
});

describe('intro fields', () => {
  test('(RF1) an M4 profile saved without the intro fields loads intact and needs the intro', async () => {
    const dbName = `m4-${Math.random()}`;
    const raw = indexedDB.open(dbName, 1);
    raw.onupgradeneeded = () => raw.result.createObjectStore('profile');
    const db = await new Promise<IDBDatabase>((r) => (raw.onsuccess = () => r(raw.result)));
    const m4 = {
      version: 1,
      credits: 420,
      collection: { x: 2 },
      decks: [{ id: 'd', name: 'D', cards: [] }],
      awardedGames: [1],
    };
    await new Promise<void>((r) => {
      const tx = db.transaction('profile', 'readwrite');
      tx.objectStore('profile').put(m4, 'me');
      tx.oncomplete = () => r();
    });
    db.close();
    const loaded = await (await openIndexedDbStore(dbName)).load();
    expect(loaded).toEqual({
      ...m4,
      playerName: null,
      starterDeck: null,
      introDone: false,
      binders: [],
      collectorMode: false,
    });
  });

  test('the memory store fills missing fields too', async () => {
    const legacy = {
      version: 1,
      credits: 9,
      collection: {},
      decks: [],
      awardedGames: [],
    } as unknown as Profile;
    expect(await createMemoryStore(legacy).load()).toMatchObject({ introDone: false, playerName: null });
  });

  test('finishIntro saves a trimmed name and the starter deck', async () => {
    const store = createMemoryStore();
    await useProfile.getState().init(store, true);
    await useProfile.getState().finishIntro('  Alex  ', 'mega-lucario');
    expect(await store.load()).toMatchObject({
      playerName: 'Alex',
      starterDeck: 'mega-lucario',
      introDone: true,
      credits: 500,
    });
    expect(useProfile.getState().profile.playerName).toBe('Alex');
  });

  test('an empty name becomes PLAYER and long names are cut to 10', async () => {
    await useProfile.getState().init(createMemoryStore(), true);
    await useProfile.getState().finishIntro('', 'mega-gengar');
    expect(useProfile.getState().profile.playerName).toBe('PLAYER');
    await useProfile.getState().setName('ABCDEFGHIJKL');
    expect(useProfile.getState().profile.playerName).toBe('ABCDEFGHIJ');
  });

  test('replayIntro clears introDone and keeps everything else', async () => {
    await useProfile.getState().init(createMemoryStore({ ...newProfile(), credits: 777 }), true);
    await useProfile.getState().finishIntro('Sam', 'mega-diancie');
    await useProfile.getState().replayIntro();
    expect(useProfile.getState().profile).toMatchObject({
      introDone: false,
      credits: 777,
      playerName: 'Sam',
    });
  });
});

describe('binders', () => {
  const binder = (id: string) => ({ ...newBinder(id, 0), name: id.toUpperCase() });

  test('saveBinder adds a binder and replaces it on a second save with the same id', async () => {
    const store = spyStore();
    await useProfile.getState().init(store, true);
    await useProfile.getState().saveBinder(binder('a'));
    await useProfile.getState().saveBinder({ ...binder('a'), name: 'RENAMED' });
    const saved = await store.load();
    expect(saved.binders.map((b) => b.name)).toEqual(['RENAMED']);
    expect(saved.binders[0]!.updatedAt).toBeGreaterThan(0);
  });

  test('a binder saved in another tab is kept when this tab saves a different one', async () => {
    const shared = createMemoryStore();
    await useProfile.getState().init(shared, true);
    await shared.save({ ...(await shared.load()), binders: [binder('b')] }); // the other tab
    await useProfile.getState().saveBinder(binder('a'));
    expect((await shared.load()).binders.map((b) => b.id).sort()).toEqual(['a', 'b']);
  });

  test(`no more than ${MAX_BINDERS} binders`, async () => {
    const full = Array.from({ length: MAX_BINDERS }, (_, i) => binder(`b${i}`));
    const store = spyStore({ ...newProfile(), binders: full });
    await useProfile.getState().init(store, true);
    await useProfile.getState().saveBinder(binder('extra'));
    expect((await store.load()).binders).toHaveLength(MAX_BINDERS);
  });

  test('deleteBinder removes it', async () => {
    const store = spyStore({ ...newProfile(), binders: [binder('a'), binder('b')] });
    await useProfile.getState().init(store, true);
    await useProfile.getState().deleteBinder('a');
    expect((await store.load()).binders.map((b) => b.id)).toEqual(['b']);
  });
});

describe('collector mode', () => {
  test('packs are free: buying with 0 credits works and leaves credits alone', async () => {
    const store = spyStore({ ...newProfile(), credits: 0 });
    await useProfile.getState().init(store, true);
    await useProfile.getState().setCollectorMode(true);
    const cards = await useProfile.getState().buyPack('me01');
    const saved = await store.load();
    expect(saved.collectorMode).toBe(true);
    expect(saved.credits).toBe(0);
    expect(total(saved.collection)).toBe(cards.length);
  });

  test('turning it off keeps the credits as they were', async () => {
    const store = spyStore({ ...newProfile(), credits: 275 });
    await useProfile.getState().init(store, true);
    await useProfile.getState().setCollectorMode(true);
    await useProfile.getState().buyPack('me02');
    await useProfile.getState().setCollectorMode(false);
    const saved = await store.load();
    expect(saved).toMatchObject({ collectorMode: false, credits: 275 });
  });
});

describe('updateBinder', () => {
  const BALL = 'me01-131';
  const LUCARIO = 'me01-077';
  const owned = { [BALL]: 1, [LUCARIO]: 1 };

  test('edits the stored binder, keeping another tab’s change to the same binder', async () => {
    const shared = createMemoryStore({ ...newProfile(), collection: owned, binders: [newBinder('x', 0)] });
    await useProfile.getState().init(shared, true);
    const other = await shared.load(); // the other tab fills slot 9
    await shared.save({ ...other, binders: [placeCard(other.binders[0]!, 0, 8, BALL, owned)] });
    await useProfile.getState().updateBinder('x', (b, collection) => placeCard(b, 0, 0, LUCARIO, collection));
    expect((await shared.load()).binders[0]!.pages[0]).toEqual([
      LUCARIO,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      BALL,
    ]);
  });

  test('does nothing when the binder was deleted elsewhere', async () => {
    const shared = createMemoryStore({ ...newProfile(), binders: [newBinder('x', 0)] });
    await useProfile.getState().init(shared, true);
    await shared.save({ ...(await shared.load()), binders: [] });
    await useProfile.getState().updateBinder('x', addPage);
    expect((await shared.load()).binders).toEqual([]);
  });

  test('two quick edits both land', async () => {
    const shared = createMemoryStore({ ...newProfile(), binders: [newBinder('x', 0)] });
    await useProfile.getState().init(shared, true);
    await Promise.all([
      useProfile.getState().updateBinder('x', addPage),
      useProfile.getState().updateBinder('x', addPage),
    ]);
    expect((await shared.load()).binders[0]!.pages).toHaveLength(3);
  });
});
