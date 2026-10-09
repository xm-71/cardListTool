import { beforeEach, expect, test } from 'vitest';
import { LEADERS, type RunDeck } from '../src/game/gym.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, normalizeProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';

const ids = LEADERS.map((l) => l.id);
const deck: RunDeck = {
  kind: 'starter',
  id: 'mega-gengar',
  name: 'Mega Gengar ex',
  cover: 'me02-056',
  cards: [{ id: 'me02-056', count: 4 }],
};
const total = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0);

async function init(p: Partial<Profile> = {}) {
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), playerName: 'ASH', ...p }), true);
}
const profile = () => useProfile.getState().profile;

beforeEach(() => useProfile.getState().reset());

test('older profiles load with no badges, no run and an empty Hall of Fame', () => {
  const p = normalizeProfile({ version: 1, credits: 5 });
  expect(p.gym).toEqual({ badges: [], run: null, hallOfFame: [] });
});

test('the first win over Brock pays 100 credits and a 151 pack (saved), and adds the badge', async () => {
  await init({ credits: 0 });
  const paid = await useProfile
    .getState()
    .recordGym({ seed: 1, leaderId: 'brock', won: true, normalCredits: 100 });
  expect(paid).toMatchObject({ credits: 100, badge: true, champion: false });
  expect(paid!.packs).toHaveLength(1);
  expect(paid!.packs[0]).toHaveLength(10);
  expect(paid!.packs[0]!.every((id) => id.startsWith('sv03.5-'))).toBe(true);
  expect(profile().gym.badges).toEqual(['brock']);
  expect(profile().credits).toBe(100);
  expect(total(profile().collection)).toBe(10);
});

test('the same game result arriving twice pays once', async () => {
  await init({ credits: 0 });
  const o = { seed: 7, leaderId: 'brock', won: true, normalCredits: 100 };
  await useProfile.getState().recordGym(o);
  expect(await useProfile.getState().recordGym(o)).toBeUndefined();
  expect(profile().credits).toBe(100);
  expect(total(profile().collection)).toBe(10);
});

test('a rematch win and a loss pay the normal bot credits with no pack', async () => {
  await init({ credits: 0, gym: { badges: ['brock'], run: null, hallOfFame: [] } });
  const rematch = await useProfile
    .getState()
    .recordGym({ seed: 1, leaderId: 'brock', won: true, normalCredits: 100 });
  expect(rematch).toMatchObject({ credits: 100, badge: false, packs: [] });
  const lost = await useProfile
    .getState()
    .recordGym({ seed: 2, leaderId: 'misty', won: false, normalCredits: 30 });
  expect(lost).toMatchObject({ credits: 30, badge: false, packs: [] });
  expect(profile().credits).toBe(130);
  expect(profile().gym.badges).toEqual(['brock']);
});

test('Giovanni, the eighth gym, pays 275', async () => {
  await init({ credits: 0, gym: { badges: ids.slice(0, 7), run: null, hallOfFame: [] } });
  const paid = await useProfile
    .getState()
    .recordGym({ seed: 3, leaderId: 'giovanni', won: true, normalCredits: 200 });
  expect(paid?.credits).toBe(275);
  expect(profile().gym.badges).toHaveLength(8);
});

test('an Elite Four run needs 8 badges, then moves on with each win and ends on a loss', async () => {
  await init({ gym: { badges: ids.slice(0, 7), run: null, hallOfFame: [] } });
  await useProfile.getState().startEliteRun(deck);
  expect(profile().gym.run).toBeNull();
  await init({ gym: { badges: ids, run: null, hallOfFame: [] } });
  await useProfile.getState().startEliteRun(deck);
  expect(profile().gym.run).toEqual({ stage: 0, deck });
  await useProfile.getState().recordElite({ seed: 1, stage: 0, won: true, deckName: 'D', cover: 'c' });
  expect(profile().gym.run?.stage).toBe(1);
  const lost = await useProfile
    .getState()
    .recordElite({ seed: 2, stage: 1, won: false, deckName: 'D', cover: 'c' });
  expect(lost).toMatchObject({ credits: 0, packs: [] });
  expect(profile().gym.run).toBeNull();
});

test('beating the Champion pays 1,000 credits and 3 packs once, then 300 and 1, and fills the Hall of Fame', async () => {
  await init({ credits: 0, gym: { badges: ids, run: { stage: 4, deck }, hallOfFame: [] } });
  const first = await useProfile
    .getState()
    .recordElite({ seed: 1, stage: 4, won: true, deckName: 'Gengar', cover: 'me02-056' });
  expect(first).toMatchObject({ credits: 1000, champion: true });
  expect(first!.packs).toHaveLength(3);
  expect(profile().gym.run).toBeNull();
  expect(profile().gym.hallOfFame).toHaveLength(1);
  expect(profile().gym.hallOfFame[0]).toMatchObject({
    playerName: 'ASH',
    deckName: 'Gengar',
    cover: 'me02-056',
  });
  // a new run is started after the Champion win
  await useProfile.getState().startEliteRun(deck);
  expect(profile().gym.run).toEqual({ stage: 0, deck });
  const store = useProfile.getState().store;
  await store.save({ ...profile(), gym: { ...profile().gym, run: { stage: 4, deck } } });
  await useProfile.getState().init(store, true);
  const again = await useProfile
    .getState()
    .recordElite({ seed: 2, stage: 4, won: true, deckName: 'Gengar', cover: 'me02-056' });
  expect(again).toMatchObject({ credits: 300 });
  expect(again!.packs).toHaveLength(1);
  expect(profile().gym.hallOfFame).toHaveLength(2);
  expect(profile().credits).toBe(1300);
  expect(total(profile().collection)).toBe(40);
});

test('beginEliteMatch marks the run, and abandonUnfinishedRun ends a run whose match never finished', async () => {
  await init({ gym: { badges: ids, run: { stage: 1, deck }, hallOfFame: [] } });
  await useProfile.getState().abandonUnfinishedRun();
  expect(profile().gym.run).toEqual({ stage: 1, deck }); // no match was started: nothing to abandon
  await useProfile.getState().beginEliteMatch(1);
  expect(profile().gym.run?.inMatch).toBe(true);
  await useProfile.getState().abandonUnfinishedRun();
  expect(profile().gym.run).toBeNull();
});

test('a finished match clears the mark and advances the run', async () => {
  await init({ gym: { badges: ids, run: { stage: 0, deck }, hallOfFame: [] } });
  await useProfile.getState().beginEliteMatch(0);
  await useProfile.getState().recordElite({ seed: 5, stage: 0, won: true, deckName: 'D', cover: 'c' });
  expect(profile().gym.run).toEqual({ stage: 1, deck });
  await useProfile.getState().abandonUnfinishedRun();
  expect(profile().gym.run?.stage).toBe(1);
});
