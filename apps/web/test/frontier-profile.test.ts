import { beforeEach, describe, expect, test } from 'vitest';
import { registry } from '../src/game/catalog.ts';
import { autoCut } from '../src/game/frontier/deck.ts';
import { HALL_OF_FAME_SIZE, normalizeFrontier } from '../src/game/frontier/save.ts';
import {
  beginFight,
  chooseStarter,
  newRun,
  recordResult,
  skipOffer,
  type FrontierRun,
} from '../src/game/frontier/run.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, normalizeProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';

async function init(p: Partial<Profile> = {}) {
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), playerName: 'ASH', ...p }), true);
}
const profile = () => useProfile.getState().profile;
const run = () => profile().frontier.run!;
const store = () => useProfile.getState();
const startedRun = (seed = 5): FrontierRun => chooseStarter(newRun(seed), newRun(seed).starterChoices[0]!);
/** A run that has won `n` fights (rewards skipped), sitting in the hub. */
const after = (n: number): FrontierRun => {
  let r = startedRun();
  for (let i = 0; i < n; i++) r = skipOffer(recordResult(beginFight(r), 'win'));
  return r;
};
let seed = 1000;
/** Plays the current fight to `outcome` through the store. */
async function fight(outcome: 'win' | 'loss' | 'draw') {
  await store().beginFrontierMatch();
  return store().recordFrontier({
    seed: seed++,
    fight: run().fight,
    won: outcome === 'win',
    draw: outcome === 'draw',
  });
}

beforeEach(() => useProfile.getState().reset());

describe('Frontier in the profile', () => {
  test('an old profile without frontier loads with no run and an empty Hall of Fame', () => {
    expect(normalizeProfile({ version: 1, credits: 5 }).frontier).toEqual({ run: null, hallOfFame: [] });
  });

  test('a malformed run (wrong types, 3 lives, unknown phase, unknown card or opponent id) is dropped on load, not thrown', () => {
    const good = startedRun();
    expect(normalizeFrontier({ run: good, hallOfFame: [] }).run).toEqual(good);
    const bad: unknown[] = [
      { ...good, lives: 3 },
      { ...good, phase: 'shop' },
      { ...good, seed: 'x' },
      { ...good, deck: [{ id: 'nope-001', count: 4 }, ...good.deck.slice(1)] },
      { ...good, opponents: good.opponents.map((o, i) => (i === 2 ? { ...o, id: 'nobody' } : o)) },
      { ...good, fight: 9 },
      'garbage',
    ];
    for (const r of bad) expect(normalizeFrontier({ run: r, hallOfFame: [] }).run).toBeNull();
    expect(normalizeFrontier(undefined)).toEqual({ run: null, hallOfFame: [] });
  });

  test('startFrontierRun / chooseFrontierStarter / skip / take save through the store; startFrontierRun does nothing while a run exists', async () => {
    await init();
    await store().startFrontierRun();
    expect(run().phase).toBe('starter');
    const first = run().seed;
    await store().startFrontierRun();
    expect(run().seed).toBe(first);
    await store().chooseFrontierStarter(run().starterChoices[1]!);
    expect(run().phase).toBe('hub');
    await fight('win');
    expect(run().phase).toBe('reward');
    await store().skipFrontierOffer();
    expect(run()).toMatchObject({ phase: 'hub', fight: 1 });
    await fight('win');
    const i = run().offers!.findIndex((o) => o.kind === 'package');
    const pkg = (run().offers![i] as { pkg: { cards: { id: string; count: number }[] } }).pkg;
    const cut = autoCut(
      run().deck,
      pkg.cards,
      pkg.cards.reduce((n, c) => n + c.count, 0),
      registry,
      true,
    )!;
    await store().takeFrontierOffer(i, cut);
    expect(run()).toMatchObject({ phase: 'hub', fight: 2 });
    // Saved, not just in memory.
    expect((await store().store.load()).frontier.run!.fight).toBe(2);
  });

  test("recordFrontier counts a result once per game seed, and ignores a result whose fight is not the run's current fight or when no match is in progress", async () => {
    await init({ frontier: { run: after(2), hallOfFame: [] } });
    await store().beginFrontierMatch();
    const loss = await store().recordFrontier({ seed: 1, fight: 2, won: false, draw: false });
    expect(loss).toMatchObject({ counted: true, outcome: 'loss', lives: 1, phase: 'hub' });
    // The same game again: nothing changes.
    expect((await store().recordFrontier({ seed: 1, fight: 2, won: false, draw: false }))?.counted).not.toBe(
      true,
    );
    expect(run().lives).toBe(1);
    // No match in progress.
    expect((await store().recordFrontier({ seed: 2, fight: 2, won: false, draw: false }))?.counted).not.toBe(
      true,
    );
    // A stale fight number (another tab).
    await store().beginFrontierMatch();
    expect((await store().recordFrontier({ seed: 3, fight: 1, won: false, draw: false }))?.counted).not.toBe(
      true,
    );
    expect(run().lives).toBe(1);
  });

  test('settleUnfinishedFrontierMatch records a loss for a run saved with inMatch', async () => {
    await init({ frontier: { run: { ...after(1), inMatch: true }, hallOfFame: [] } });
    await store().settleUnfinishedFrontierMatch();
    expect(run()).toMatchObject({ lives: 1, fight: 1, phase: 'hub' });
    expect(run().inMatch).toBeFalsy();
    await store().settleUnfinishedFrontierMatch();
    expect(run().lives).toBe(1);
  });

  test('endFrontierRun pays the credits, adds the kept card to the collection, clears the run', async () => {
    let r = after(7);
    r = recordResult(beginFight(r), 'win'); // cleared
    await init({ credits: 0, collection: {}, frontier: { run: r, hallOfFame: [] } });
    const keep = r.deck.find((c) => registry.defs[c.id]!.category === 'Pokemon')!.id;
    expect(await store().endFrontierRun(keep)).toEqual({ credits: 1240 });
    expect(profile().credits).toBe(1240);
    expect(profile().collection[keep]).toBe(1);
    expect(profile().frontier.run).toBeNull();
  });

  test('a cleared run adds a Hall of Fame entry (newest first, capped at 20); a lost run does not', async () => {
    const cleared = recordResult(beginFight(after(7)), 'win');
    const old = Array.from({ length: HALL_OF_FAME_SIZE }, (_, i) => ({
      date: '2026-01-01',
      playerName: `P${i}`,
      deckName: 'd',
      cover: 'me02-056',
      livesLeft: 2,
    }));
    await init({ frontier: { run: cleared, hallOfFame: old } });
    await store().endFrontierRun(null);
    const hall = profile().frontier.hallOfFame;
    expect(hall).toHaveLength(HALL_OF_FAME_SIZE);
    expect(hall[0]).toMatchObject({ playerName: 'ASH', livesLeft: 2, cover: cleared.cover });

    const lost = recordResult(recordResult(beginFight(after(3)), 'loss'), 'loss');
    await init({ frontier: { run: { ...lost, phase: 'over' }, hallOfFame: [] } });
    await store().endFrontierRun(null);
    expect(profile().frontier.hallOfFame).toEqual([]);
  });

  test('abandonFrontierRun ends the run, and claiming it pays for fights won', async () => {
    await init({ credits: 0, frontier: { run: after(4), hallOfFame: [] } });
    await store().abandonFrontierRun();
    expect(run().phase).toBe('over');
    expect(await store().endFrontierRun(null)).toEqual({ credits: 300 });
    expect(profile().credits).toBe(300);
  });
});
