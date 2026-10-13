import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '@ptcg/cards';
import {
  JOHTO_LEADERS,
  JOHTO_PACK_SET,
  JOHTO_TOTAL,
  JOHTO_UPCOMING,
  LEADERS,
  applyGymResult,
  badgeReward,
  canChallenge,
  canStartElite,
  emptyGym,
  findLeader,
  gymStatus,
  johtoBadgeReward,
  johtoUnlocked,
  leadersOf,
  nextGymIndex,
  normalizeGym,
  regionOf,
} from '../src/game/gym.ts';
import { townStatus } from '../src/game/town.ts';
import { newProfile } from '../src/profile/types.ts';

const kanto = LEADERS.map((l) => l.id);
const entry = { date: '2026-10-13', playerName: 'ASH', deckName: 'Deck', cover: 'me01-077' };

describe('the Johto leaders', () => {
  test('are Falkner, Bugsy, Whitney and Morty, with Medium then Hard bots and real decks', () => {
    expect(leadersOf('johto').map((l) => l.id)).toEqual(['falkner', 'bugsy', 'whitney', 'morty']);
    expect(JOHTO_LEADERS.map((l) => l.difficulty)).toEqual(['medium', 'medium', 'hard', 'hard']);
    expect(JOHTO_LEADERS.map((l) => l.badge)).toEqual(['Zephyr', 'Hive', 'Plain', 'Fog']);
    for (const l of JOHTO_LEADERS) {
      expect(GYM_DECKS[l.deck], l.id).toBeDefined();
      expect(l.intro.length).toBeGreaterThan(10);
    }
    expect(leadersOf('kanto')).toBe(LEADERS);
  });

  test('the later four are listed as upcoming and the case has 8 places', () => {
    expect(JOHTO_UPCOMING.map((l) => l.name)).toEqual(['Chuck', 'Jasmine', 'Pryce', 'Clair']);
    expect(JOHTO_TOTAL).toBe(8);
    expect(JOHTO_LEADERS.length + JOHTO_UPCOMING.length).toBe(JOHTO_TOTAL);
  });

  test('findLeader and regionOf search both regions', () => {
    expect(findLeader('falkner')?.name).toBe('Falkner');
    expect(findLeader('brock')?.name).toBe('Brock');
    expect(findLeader('nobody')).toBeUndefined();
    expect(regionOf('morty')).toBe('johto');
    expect(regionOf('giovanni')).toBe('kanto');
    expect(regionOf('nobody')).toBeNull();
  });
});

describe('order rules per region', () => {
  test('each region has its own next gym', () => {
    expect(gymStatus([], 'brock')).toBe('next');
    expect(gymStatus([], 'falkner')).toBe('next');
    expect(gymStatus(['falkner'], 'bugsy')).toBe('next');
    expect(gymStatus(['falkner'], 'whitney')).toBe('locked');
    expect(gymStatus(['falkner'], 'falkner')).toBe('beaten');
    expect(gymStatus(['falkner'], 'brock')).toBe('next');
    expect(canChallenge(['falkner'], 'morty')).toBe(false);
    expect(canChallenge(['falkner'], 'bugsy')).toBe(true);
    expect(nextGymIndex(['falkner', 'bugsy'], JOHTO_LEADERS)).toBe(2);
    expect(nextGymIndex(['falkner', 'bugsy'])).toBe(0);
  });

  test('the Elite Four needs all 8 Kanto badges and ignores Johto badges', () => {
    const johto = JOHTO_LEADERS.map((l) => l.id);
    expect(canStartElite([...kanto.slice(0, 7), ...johto])).toBe(false);
    expect(canStartElite(kanto)).toBe(true);
    expect(canStartElite([...kanto, ...johto])).toBe(true);
  });

  test('the town badge count stays Kanto-only', () => {
    const p = { ...newProfile(), gym: { ...emptyGym(), badges: ['falkner', 'brock'] } };
    expect(townStatus(p).badges).toBe(1);
  });
});

describe('unlock and rewards', () => {
  test('Johto opens once the Hall of Fame has an entry', () => {
    expect(johtoUnlocked(emptyGym())).toBe(false);
    expect(johtoUnlocked({ ...emptyGym(), hallOfFame: [entry] })).toBe(true);
  });

  test('a Johto badge pays 150 + 25 per gym and a me02 pack; Kanto is unchanged', () => {
    expect(JOHTO_PACK_SET).toBe('me02');
    expect(johtoBadgeReward(0)).toEqual({ credits: 150, packs: 1, set: 'me02' });
    expect(johtoBadgeReward(2)).toEqual({ credits: 200, packs: 1, set: 'me02' });
    expect(badgeReward(0)).toEqual({ credits: 100, packs: 1 });
    expect(badgeReward(0).set).toBeUndefined();
  });
});

describe('applyGymResult for Johto', () => {
  test('a first win adds the badge and pays the Johto reward', () => {
    const { next, reward } = applyGymResult(emptyGym(), 'falkner', true);
    expect(next.badges).toEqual(['falkner']);
    expect(reward).toEqual(johtoBadgeReward(0));
  });

  test('a rematch, a loss and an out-of-order win change nothing', () => {
    const g = { ...emptyGym(), badges: ['falkner'] };
    expect(applyGymResult(g, 'falkner', true)).toEqual({ next: g, reward: null });
    expect(applyGymResult(g, 'bugsy', false)).toEqual({ next: g, reward: null });
    expect(applyGymResult(g, 'morty', true)).toEqual({ next: g, reward: null });
  });

  test('Kanto wins still pay the 151 reward by their own index', () => {
    const { reward } = applyGymResult({ ...emptyGym(), badges: ['falkner', 'brock'] }, 'misty', true);
    expect(reward).toEqual(badgeReward(1));
  });
});

describe('normalizeGym', () => {
  test('keeps ids of both regions, drops unknown ones', () => {
    expect(normalizeGym({ badges: ['falkner', 'brock', 'nobody'] }).badges).toEqual(['falkner', 'brock']);
  });
});
