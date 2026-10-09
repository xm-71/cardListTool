import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '@ptcg/cards';
import {
  CHAMPION_STAGE,
  ELITE,
  LEADERS,
  applyEliteResult,
  applyGymResult,
  badgeReward,
  canChallenge,
  canStartElite,
  championDeckFor,
  championReward,
  emptyGym,
  gymStatus,
  mainEnergyType,
  nextGymIndex,
  normalizeGym,
  startRun,
  beginMatch,
  abandonUnfinishedRun,
  type GymProgress,
  type RunDeck,
} from '../src/game/gym.ts';
import { registry } from '../src/game/catalog.ts';

const all = LEADERS.map((l) => l.id);
const withBadges = (n: number): GymProgress => ({ ...emptyGym(), badges: all.slice(0, n) });
const entry = { date: '2026-10-09', playerName: 'ASH', deckName: 'Mega Gengar ex', cover: 'me02-056' };
const deck: RunDeck = {
  kind: 'starter',
  id: 'mega-gengar',
  name: 'Mega Gengar ex',
  cover: 'me02-056',
  cards: [{ id: 'me02-056', count: 4 }],
};

describe('data', () => {
  test('8 gyms then 5 elite stages, every deck exists and the Medium bot starts at Koga', () => {
    expect(LEADERS.map((l) => l.id)).toEqual([
      'brock',
      'misty',
      'surge',
      'erika',
      'koga',
      'sabrina',
      'blaine',
      'giovanni',
    ]);
    expect(ELITE.map((l) => l.id)).toEqual(['lorelei', 'bruno', 'agatha', 'lance', 'champion']);
    for (const o of [...LEADERS, ...ELITE]) {
      expect(GYM_DECKS[o.deck], o.id).toBeDefined();
      expect(registry.defs[o.cover], o.id).toBeDefined();
    }
    expect(LEADERS.map((l) => l.difficulty)).toEqual([...Array(4).fill('easy'), ...Array(4).fill('medium')]);
    expect(ELITE.every((o) => o.difficulty === 'medium')).toBe(true);
  });
  test('badge credits: 100 for Brock, plus 25 per later gym (Giovanni 275), one pack each', () => {
    expect(badgeReward(0)).toEqual({ credits: 100, packs: 1 });
    expect(badgeReward(7)).toEqual({ credits: 275, packs: 1 });
  });
  test('Champion pays 1,000 + 3 packs the first time, then 300 + 1', () => {
    expect(championReward(true)).toEqual({ credits: 1000, packs: 3 });
    expect(championReward(false)).toEqual({ credits: 300, packs: 1 });
  });
});

describe('gyms unlock in order', () => {
  test('only the next unbeaten gym and beaten gyms can be challenged', () => {
    const b = withBadges(2).badges;
    expect(nextGymIndex(b)).toBe(2);
    expect(gymStatus(b, 'brock')).toBe('beaten');
    expect(gymStatus(b, 'surge')).toBe('next');
    expect(gymStatus(b, 'erika')).toBe('locked');
    expect(canChallenge(b, 'misty')).toBe(true);
    expect(canChallenge(b, 'koga')).toBe(false);
  });
  test('a first win earns the badge and its reward; a rematch win or a loss does not', () => {
    const first = applyGymResult(emptyGym(), 'brock', true);
    expect(first.next.badges).toEqual(['brock']);
    expect(first.reward).toEqual({ credits: 100, packs: 1 });
    expect(applyGymResult(first.next, 'brock', true)).toEqual({ next: first.next, reward: null });
    expect(applyGymResult(emptyGym(), 'brock', false)).toEqual({ next: emptyGym(), reward: null });
  });
  test('a locked gym can not be won out of order', () => {
    expect(applyGymResult(emptyGym(), 'surge', true).reward).toBeNull();
  });
  test('8 badges unlock the Elite Four', () => {
    expect(canStartElite(withBadges(7).badges)).toBe(false);
    expect(canStartElite(withBadges(8).badges)).toBe(true);
  });
});

describe('the Elite Four run', () => {
  const run = (stage = 0): GymProgress => ({ ...withBadges(8), run: { stage, deck } });
  test('needs 8 badges to start and keeps an unfinished run', () => {
    expect(startRun(withBadges(7), deck).run).toBeNull();
    const started = startRun(withBadges(8), deck);
    expect(started.run).toEqual({ stage: 0, deck });
    expect(startRun(run(2), { ...deck, kind: 'theme', id: 'x' }).run).toEqual({ stage: 2, deck });
  });
  test('a win moves to the next stage with no reward', () => {
    expect(applyEliteResult(run(0), 0, true, entry)).toEqual({ next: run(1), reward: null });
  });
  test('a loss ends the run, which restarts from Lorelei', () => {
    const lost = applyEliteResult(run(3), 3, false, entry);
    expect(lost.next.run).toBeNull();
    expect(startRun(lost.next, deck).run?.stage).toBe(0);
  });
  test('beating the Champion ends the run, adds a Hall of Fame entry and pays the first-time reward', () => {
    const won = applyEliteResult(run(CHAMPION_STAGE), CHAMPION_STAGE, true, entry);
    expect(won.next.run).toBeNull();
    expect(won.next.hallOfFame).toEqual([entry]);
    expect(won.reward).toEqual({ credits: 1000, packs: 3 });
    const again = applyEliteResult(
      { ...won.next, run: { stage: CHAMPION_STAGE, deck } },
      CHAMPION_STAGE,
      true,
      { ...entry, date: '2026-10-10' },
    );
    expect(again.reward).toEqual({ credits: 300, packs: 1 });
    expect(again.next.hallOfFame.map((e) => e.date)).toEqual(['2026-10-10', '2026-10-09']);
  });
  test('quitting or reloading mid-match is a loss: a started match marks the run, and an unfinished one ends it', () => {
    const marked = beginMatch(run(2), 2);
    expect(marked.run).toMatchObject({ stage: 2, inMatch: true });
    expect(beginMatch(run(2), 3)).toEqual(run(2)); // a different stage is not this match
    expect(abandonUnfinishedRun(marked).run).toBeNull();
    expect(abandonUnfinishedRun(run(2))).toEqual(run(2)); // nothing was started
    // finishing the match with a win clears the mark
    expect(applyEliteResult(marked, 2, true, entry).next.run).toEqual({ stage: 3, deck });
  });
  test('a result for the wrong stage, or with no run, changes nothing', () => {
    expect(applyEliteResult(run(1), 0, true, entry).next).toEqual(run(1));
    expect(applyEliteResult(withBadges(8), 0, true, entry).reward).toBeNull();
  });
});

describe('Champion Blue’s ace', () => {
  test('follows the main Energy type of the challenger’s deck', () => {
    expect(championDeckFor('Fire')).toBe('blue-water'); // Blastoise
    expect(championDeckFor('Grass')).toBe('blue-fire'); // Charizard
    expect(championDeckFor('Water')).toBe('blue-grass'); // Venusaur
    expect(championDeckFor('Darkness')).toBe('blue-fire');
    expect(championDeckFor(null)).toBe('blue-fire');
  });
  test('the main Energy type is the commonest Basic Energy in the deck', () => {
    expect(
      mainEnergyType(
        {
          name: 'x',
          cards: [
            { id: 'mee-002', count: 10 },
            { id: 'mee-003', count: 12 },
            { id: 'sv03.5-076', count: 4 },
          ],
        },
        registry.defs,
      ),
    ).toBe('Water');
    expect(mainEnergyType({ name: 'x', cards: [{ id: 'sv03.5-076', count: 4 }] }, registry.defs)).toBeNull();
  });
});

describe('normalizeGym', () => {
  test('old profiles get no badges, no run and an empty Hall of Fame', () => {
    expect(normalizeGym(undefined)).toEqual(emptyGym());
  });
  test('bad data is dropped: unknown badges, duplicates, a run without all badges, bad entries', () => {
    const g = normalizeGym({
      badges: ['brock', 'brock', 'nope', 3],
      run: { stage: 1, deck },
      hallOfFame: [entry, { date: 1 }],
    });
    expect(g.badges).toEqual(['brock']);
    expect(g.run).toBeNull();
    expect(g.hallOfFame).toEqual([entry]);
  });
  test('a valid run is kept', () => {
    expect(normalizeGym({ badges: all, run: { stage: 2, deck } }).run).toEqual({ stage: 2, deck });
    expect(normalizeGym({ badges: all, run: { stage: 2, deck, inMatch: true } }).run).toMatchObject({
      inMatch: true,
    });
    // an old-style run that only names a deck is dropped: it has no saved copy of the deck
    expect(
      normalizeGym({ badges: all, run: { stage: 2, deck: { kind: 'starter', id: 'x' } } }).run,
    ).toBeNull();
    expect(normalizeGym({ badges: all, run: { stage: 9, deck } }).run).toBeNull();
  });
});
