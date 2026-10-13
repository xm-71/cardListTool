import { describe, expect, test } from 'vitest';
import { chooseStarter, newRun, recordResult, beginFight, skipOffer } from '../src/game/frontier/run.ts';
import { BUILDINGS, describeBuilding, moveInTown, townStatus, type BuildingId } from '../src/game/town.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';

const profile = (p: Partial<Profile> = {}): Profile => ({ ...newProfile(), playerName: 'ASH', ...p });
const gym = (badges: string[], hallOfFame: Profile['gym']['hallOfFame'] = []) => ({
  badges,
  run: null,
  hallOfFame,
});
const frontierAfter = (wins: number) => {
  let r = chooseStarter(newRun(5), newRun(5).starterChoices[0]!);
  for (let i = 0; i < wins; i++) r = skipOffer(recordResult(beginFight(r), 'win'));
  return { run: r, hallOfFame: [] };
};
const all = () => true;

describe('the town layout', () => {
  test('eight buildings, listed in the old menu order with My House last', () => {
    expect(BUILDINGS.map((b) => b.label)).toEqual([
      'Duel',
      'Gym Challenge',
      'Battle Frontier',
      'Shop',
      'Binder',
      'Decks',
      'Options',
      'My House',
    ]);
  });

  test('they sit around the square, with the fountain in the middle', () => {
    const at = Object.fromEntries(BUILDINGS.map((b) => [b.id, [b.row, b.col]]));
    expect(at).toEqual({
      house: [0, 0],
      gym: [0, 1],
      frontier: [0, 2],
      shop: [1, 0],
      duel: [1, 2],
      decks: [2, 0],
      binder: [2, 1],
      options: [2, 2],
    });
  });
});

describe('moving around the square', () => {
  const cases: [BuildingId, string, BuildingId][] = [
    ['duel', 'ArrowLeft', 'shop'], // across the fountain
    ['gym', 'ArrowDown', 'binder'], // across the fountain
    ['house', 'ArrowRight', 'gym'],
    ['house', 'ArrowDown', 'shop'],
    ['options', 'ArrowUp', 'duel'],
    ['house', 'ArrowLeft', 'house'], // the edge: stay put
    ['options', 'ArrowDown', 'options'],
  ];
  test.each(cases)('from %s, %s goes to %s', (from, key, to) => {
    expect(moveInTown(from, key, all)).toBe(to);
  });

  test('closed buildings are walked past', () => {
    const open = (id: BuildingId) => ['shop', 'binder', 'options', 'house'].includes(id);
    expect(moveInTown('binder', 'ArrowRight', open)).toBe('options');
    expect(moveInTown('house', 'ArrowRight', open)).toBe('house'); // Gym and Frontier closed
    expect(moveInTown('options', 'ArrowUp', open)).toBe('options'); // Duel Hall closed, Frontier closed
  });

  test('other keys do not move', () => {
    expect(moveInTown('duel', 'Enter', all)).toBe('duel');
  });
});

describe('progress shown on the buildings', () => {
  test('a new player: no badges, no run, a pack affordable, nothing owned', () => {
    expect(townStatus(profile())).toEqual({
      badges: 0,
      champion: false,
      frontier: null,
      canBuyPack: true,
      owned: 0,
    });
  });

  test('badges, champion, a Frontier run, credits and the binder count come from the save', () => {
    const s = townStatus(
      profile({
        gym: gym(
          ['brock', 'misty', 'surge'],
          [{ date: '2026-10-01', playerName: 'ASH', deckName: 'X', cover: 'x' }],
        ),
        frontier: frontierAfter(2),
        credits: 100,
        collection: { 'me01-001': 2, 'me01-002': 0, 'me01-003': 1 },
      }),
    );
    expect(s).toEqual({
      badges: 3,
      champion: true,
      frontier: { fight: 2, wins: 2, lives: 2 },
      canBuyPack: false,
      owned: 2,
    });
  });

  test('a finished Frontier run shows no lit floors', () => {
    let r = frontierAfter(1).run;
    r = recordResult(recordResult(beginFight(r), 'loss'), 'loss');
    expect(r.phase).toBe('over');
    expect(townStatus(profile({ frontier: { run: r, hallOfFame: [] } })).frontier).toBeNull();
  });

  test('in Collector mode packs are free, so the Mart shows no NEW sign', () => {
    expect(townStatus(profile({ collectorMode: true, credits: 0 })).canBuyPack).toBe(false);
  });
});

describe('what the dialog box says', () => {
  test('the Gym names the next leader and its type', () => {
    const p = profile({ gym: gym(['brock', 'misty', 'surge']) });
    expect(describeBuilding('gym', p, '')).toBe('3 of 8 badges. Next up: Erika, Grass type.');
    expect(describeBuilding('gym', profile(), '')).toBe('0 of 8 badges. Next up: Brock, Fighting type.');
  });

  test('with all 8 badges the Gym points to the Elite Four', () => {
    const ids = ['brock', 'misty', 'surge', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni'];
    expect(describeBuilding('gym', profile({ gym: gym(ids) }), '')).toBe(
      'All 8 badges! The Elite Four are waiting.',
    );
  });

  test('once the Champion is beaten, the Gym says so', () => {
    const ids = ['brock', 'misty', 'surge', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni'];
    const hall = [{ date: '2026-10-01', playerName: 'ASH', deckName: 'X', cover: 'x' }];
    expect(describeBuilding('gym', profile({ gym: gym(ids, hall) }), '')).toBe(
      'Champion! Rematch the Elite Four any time.',
    );
  });

  test('the Frontier describes the run in progress, or how a run works', () => {
    expect(describeBuilding('frontier', profile({ frontier: frontierAfter(2) }), '')).toBe(
      'Run in progress: fight 3 of 8, 2 lives left.',
    );
    expect(describeBuilding('frontier', profile(), '')).toBe('8 fights, 2 lives. Build your deck as you go.');
  });

  test('the Mart gives the price, or says packs are free in Collector mode', () => {
    expect(describeBuilding('shop', profile({ credits: 1240 }), '')).toBe(
      'Packs cost 150 credits. You have 1,240.',
    );
    expect(describeBuilding('shop', profile({ collectorMode: true }), '')).toBe(
      'Packs are free in Collector mode.',
    );
  });

  test('the Binder counts the collection and names the most recently edited binder', () => {
    const binders = [
      { id: 'a', name: 'Old one', updatedAt: 1 },
      { id: 'b', name: 'Newest', updatedAt: 9 },
    ] as unknown as Profile['binders'];
    expect(describeBuilding('binder', profile({ collection: { x: 1 } }), '')).toBe(
      'Your collection: 1 different card.',
    );
    expect(describeBuilding('binder', profile({ binders }), '')).toBe(
      'Your collection: 0 different cards. Latest binder: Newest.',
    );
  });

  test('My House delivers the tip of the day', () => {
    expect(describeBuilding('house', profile(), 'Basic Energy is free.')).toBe(
      'Your Trainer Card. Mail: Basic Energy is free.',
    );
  });

  test('a closed building says so in Collector mode', () => {
    expect(describeBuilding('duel', profile({ collectorMode: true }), '')).toBe(
      'Closed while Collector mode is on.',
    );
  });
});
