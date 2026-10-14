import { describe, expect, test } from 'vitest';
import { GYM_DECKS } from '@ptcg/cards';
import {
  CHAMPION_STAGE,
  ELITE,
  JOHTO_ELITE,
  JOHTO_LEADERS,
  JOHTO_PACK_SET,
  RED,
  RED_FIRST_REWARD,
  JOHTO_TOTAL,
  LEADERS,
  abandonUnfinishedRun,
  applyEliteResult,
  applyGymResult,
  applyRedResult,
  badgeReward,
  beginMatch,
  canChallenge,
  canStartElite,
  championReward,
  championStage,
  eliteOf,
  emptyGym,
  findLeader,
  gymStatus,
  johtoBadgeReward,
  johtoChampion,
  johtoUnlocked,
  kantoChampion,
  leadersOf,
  nextGymIndex,
  normalizeGym,
  redUnlocked,
  regionOf,
  startRun,
  type GymProgress,
} from '../src/game/gym.ts';
import { townStatus } from '../src/game/town.ts';
import { newProfile } from '../src/profile/types.ts';

const kanto = LEADERS.map((l) => l.id);
const entry = { date: '2026-10-13', playerName: 'ASH', deckName: 'Deck', cover: 'me01-077' };

describe('the Johto leaders', () => {
  test('are the eight Johto leaders in order, with Medium then Hard bots and real decks', () => {
    expect(leadersOf('johto').map((l) => l.id)).toEqual([
      'falkner',
      'bugsy',
      'whitney',
      'morty',
      'chuck',
      'jasmine',
      'pryce',
      'clair',
    ]);
    expect(JOHTO_LEADERS.map((l) => l.difficulty)).toEqual([
      'medium',
      'medium',
      ...Array<'hard'>(6).fill('hard'),
    ]);
    expect(JOHTO_LEADERS.map((l) => l.badge)).toEqual([
      'Zephyr',
      'Hive',
      'Plain',
      'Fog',
      'Storm',
      'Mineral',
      'Glacier',
      'Rising',
    ]);
    for (const l of JOHTO_LEADERS) {
      expect(GYM_DECKS[l.deck], l.id).toBeDefined();
      expect(l.intro.length).toBeGreaterThan(10);
    }
    expect(leadersOf('kanto')).toBe(LEADERS);
  });

  test('the case has 8 places', () => {
    expect(JOHTO_TOTAL).toBe(8);
    expect(JOHTO_LEADERS).toHaveLength(JOHTO_TOTAL);
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
  test('Chuck opens after Morty, and Clair after Pryce', () => {
    const first4 = ['falkner', 'bugsy', 'whitney', 'morty'];
    expect(gymStatus(first4, 'chuck')).toBe('next');
    expect(gymStatus(first4, 'jasmine')).toBe('locked');
    const first7 = [...first4, 'chuck', 'jasmine', 'pryce'];
    expect(gymStatus(first7, 'clair')).toBe('next');
    expect(gymStatus(first7, 'pryce')).toBe('beaten');
    expect(gymStatus([...first7, 'clair'], 'clair')).toBe('beaten');
  });

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

  test('the last four Johto gyms pay 250, 275, 300 and 325', () => {
    expect([4, 5, 6, 7].map((i) => johtoBadgeReward(i).credits)).toEqual([250, 275, 300, 325]);
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

describe('the Johto Elite Four', () => {
  const johtoBadges = JOHTO_LEADERS.map((l) => l.id);
  const deck = {
    kind: 'starter' as const,
    id: 'x',
    name: 'Deck',
    cover: 'me01-077',
    cards: [{ id: 'mee-001', count: 60 }],
  };
  const jEntry = { ...entry, region: 'johto' as const };
  const johtoReady = (): GymProgress => ({ ...emptyGym(), badges: [...johtoBadges] });
  const johtoRun = (stage: number): GymProgress => ({
    ...johtoReady(),
    run: { stage, region: 'johto', deck },
  });
  const kantoRun = (stage: number): GymProgress => ({
    ...emptyGym(),
    badges: [...kanto],
    run: { stage, deck },
  });

  test('JOHTO_ELITE is Will, Koga, Bruno, Karen and Champion Lance, all Hard with real decks', () => {
    expect(JOHTO_ELITE.map((o) => o.id)).toEqual([
      'will',
      'johto-koga',
      'johto-bruno',
      'karen',
      'johto-lance',
    ]);
    expect(JOHTO_ELITE.map((o) => o.name)).toEqual(['Will', 'Koga', 'Bruno', 'Karen', 'Champion Lance']);
    expect(JOHTO_ELITE.every((o) => o.difficulty === 'hard')).toBe(true);
    for (const o of JOHTO_ELITE) expect(GYM_DECKS[o.deck], o.id).toBeDefined();
    expect(eliteOf('johto')).toBe(JOHTO_ELITE);
    expect(eliteOf('kanto')).toBe(ELITE);
    expect(championStage('johto')).toBe(4);
    expect(championStage('kanto')).toBe(CHAMPION_STAGE);
  });

  test('canStartElite needs all eight leaders of the region', () => {
    expect(canStartElite(johtoBadges, 'johto')).toBe(true);
    expect(canStartElite(johtoBadges.slice(0, 7), 'johto')).toBe(false);
    expect(canStartElite(kanto, 'johto')).toBe(false);
    expect(canStartElite(johtoBadges)).toBe(false);
    expect(canStartElite(kanto)).toBe(true);
  });

  test('startRun starts a Johto run at stage 0 and refuses while any run exists, in either region', () => {
    expect(startRun(johtoReady(), deck, 'johto').run).toEqual({ stage: 0, region: 'johto', deck });
    expect(startRun(emptyGym(), deck, 'johto').run).toBeNull();
    const both = { ...kantoRun(1), badges: [...kanto, ...johtoBadges] };
    expect(startRun(both, deck, 'johto')).toBe(both);
    const other = { ...johtoRun(1), badges: [...kanto, ...johtoBadges] };
    expect(startRun(other, deck)).toBe(other);
  });

  test('kantoChampion ignores Johto entries; entries without a region count as Kanto', () => {
    const g = emptyGym();
    expect(kantoChampion({ ...g, hallOfFame: [jEntry] })).toBe(false);
    expect(johtoChampion({ ...g, hallOfFame: [jEntry] })).toBe(true);
    expect(kantoChampion({ ...g, hallOfFame: [entry] })).toBe(true);
    expect(johtoChampion({ ...g, hallOfFame: [entry] })).toBe(false);
  });

  test('a Johto Hall of Fame entry does not unlock Johto or the town champion flag; a Kanto one does', () => {
    expect(johtoUnlocked({ ...emptyGym(), hallOfFame: [jEntry] })).toBe(false);
    expect(johtoUnlocked({ ...emptyGym(), hallOfFame: [entry] })).toBe(true);
    const p = newProfile();
    expect(townStatus({ ...p, gym: { ...emptyGym(), hallOfFame: [jEntry] } }).champion).toBe(false);
    expect(townStatus({ ...p, gym: { ...emptyGym(), hallOfFame: [entry] } }).champion).toBe(true);
  });

  test('the Johto Champion pays 1500 + 3 me02 packs the first time, then 400 + 1', () => {
    expect(championReward(true, 'johto')).toEqual({ credits: 1500, packs: 3, set: 'me02' });
    expect(championReward(false, 'johto')).toEqual({ credits: 400, packs: 1, set: 'me02' });
    expect(championReward(true)).toEqual({ credits: 1000, packs: 3 });
  });

  test('winning moves on, a draw replays the stage, a loss ends the run', () => {
    expect(applyEliteResult(johtoRun(0), 0, true, jEntry).next.run).toEqual({
      stage: 1,
      region: 'johto',
      deck,
    });
    expect(applyEliteResult(johtoRun(2), 2, true, jEntry, true).next.run).toEqual({
      stage: 2,
      region: 'johto',
      deck,
    });
    expect(applyEliteResult(johtoRun(2), 2, false, jEntry).next.run).toBeNull();
  });

  test('beating Lance records a Johto entry, ends the run and pays the Johto reward, independent of Kanto', () => {
    const won = applyEliteResult(johtoRun(4), 4, true, jEntry);
    expect(won.next.run).toBeNull();
    expect(won.next.hallOfFame).toEqual([jEntry]);
    expect(won.reward).toEqual(championReward(true, 'johto'));
    const kantoFirst = { ...johtoRun(4), hallOfFame: [entry] };
    expect(applyEliteResult(kantoFirst, 4, true, jEntry).reward).toEqual(championReward(true, 'johto'));
    const again = { ...johtoRun(4), hallOfFame: [jEntry, entry] };
    expect(applyEliteResult(again, 4, true, jEntry).reward).toEqual(championReward(false, 'johto'));
  });

  test('a Johto result against a Kanto run, or a stale stage, counts for nothing', () => {
    const k = kantoRun(2);
    expect(applyEliteResult(k, 2, true, jEntry, false, 'johto')).toEqual({
      next: k,
      reward: null,
      stale: true,
    });
    const j = johtoRun(2);
    expect(applyEliteResult(j, 2, true, entry, false, 'kanto')).toEqual({
      next: j,
      reward: null,
      stale: true,
    });
    expect(applyEliteResult(j, 1, true, jEntry).stale).toBe(true);
  });

  test('a Kanto Champion win is unchanged and its entry has no region', () => {
    const won = applyEliteResult(kantoRun(CHAMPION_STAGE), CHAMPION_STAGE, true, entry);
    expect(won.next.hallOfFame).toEqual([entry]);
    expect(won.reward).toEqual({ credits: 1000, packs: 3 });
  });

  test('abandoning an unfinished Johto match ends the run', () => {
    const g = beginMatch(johtoRun(1), 1, 'johto');
    expect(g.run?.inMatch).toBe(true);
    expect(abandonUnfinishedRun(g).run).toBeNull();
  });

  test('normalizeGym keeps a Johto run and entries, defaults the rest to Kanto, and bounds the stage', () => {
    const base = { badges: [...kanto, ...johtoBadges] };
    expect(normalizeGym({ ...base, run: { stage: 3, region: 'johto', deck } }).run).toEqual({
      stage: 3,
      region: 'johto',
      deck,
    });
    expect(normalizeGym({ ...base, run: { stage: 3, deck } }).run).toEqual({ stage: 3, deck });
    expect(normalizeGym({ ...base, run: { stage: 5, region: 'johto', deck } }).run).toBeNull();
    expect(normalizeGym({ ...base, run: { stage: 3, region: 'nowhere', deck } }).run).toEqual({
      stage: 3,
      deck,
    });
    expect(normalizeGym({ badges: kanto, run: { stage: 1, region: 'johto', deck } }).run).toBeNull();
    expect(normalizeGym({ badges: johtoBadges, run: { stage: 1, deck } }).run).toBeNull();
    const h = normalizeGym({ hallOfFame: [entry, jEntry, { ...entry, region: 'mars' }] }).hallOfFame;
    expect(h.map((e) => e.region)).toEqual([undefined, 'johto', undefined]);
  });
});

describe('Red', () => {
  const jEntry = { ...entry, region: 'johto' as const };

  test('RED is a Hard-bot opponent with his own deck', () => {
    expect(RED).toMatchObject({ id: 'red', name: 'Red', difficulty: 'hard', deck: 'red' });
    expect(GYM_DECKS[RED.deck]).toBeDefined();
  });

  test('redUnlocked needs a Johto Hall of Fame entry', () => {
    expect(redUnlocked(emptyGym())).toBe(false);
    expect(redUnlocked({ ...emptyGym(), hallOfFame: [entry] })).toBe(false);
    expect(redUnlocked({ ...emptyGym(), hallOfFame: [jEntry] })).toBe(true);
  });

  test('the first win pays 2000 and 3 me02 packs and sets redBeaten', () => {
    const g = { ...emptyGym(), hallOfFame: [jEntry] };
    const { next, reward } = applyRedResult(g, true);
    expect(reward).toEqual({ credits: 2000, packs: 3, set: 'me02' });
    expect(reward).toEqual(RED_FIRST_REWARD);
    expect(next.redBeaten).toBe(true);
  });

  test('a rematch win, a loss, and a win before the Johto Champion change nothing', () => {
    const beaten = { ...emptyGym(), hallOfFame: [jEntry], redBeaten: true };
    expect(applyRedResult(beaten, true)).toEqual({ next: beaten, reward: null });
    const fresh = { ...emptyGym(), hallOfFame: [jEntry] };
    expect(applyRedResult(fresh, false)).toEqual({ next: fresh, reward: null });
    const locked = { ...emptyGym(), hallOfFame: [entry] };
    expect(applyRedResult(locked, true)).toEqual({ next: locked, reward: null });
  });

  test('normalizeGym defaults redBeaten to false and rejects non-booleans', () => {
    expect(normalizeGym({}).redBeaten).toBe(false);
    expect(normalizeGym({ redBeaten: true }).redBeaten).toBe(true);
    expect(normalizeGym({ redBeaten: 'yes' }).redBeaten).toBe(false);
    expect(emptyGym().redBeaten).toBe(false);
  });
});
