import { describe, expect, test } from 'vitest';
import type { CardDef, CardScript } from '../src/cards.ts';
import { createEngine } from '../src/engine.ts';
import type { GameState, PlayerId } from '../src/types.ts';
import { ITEM, act, giveCard, has, miniRegistry, started } from './fixtures.ts';

const trainer = (
  id: string,
  name: string,
  trainerType: 'Item' | 'Supporter' | 'Stadium' | 'Tool',
): CardDef => ({
  ...(ITEM as Extract<CardDef, { category: 'Trainer' }>),
  id,
  name,
  trainerType,
});
const defs = [
  trainer('sup', 'Helper', 'Supporter'),
  trainer('arena', 'Arena', 'Stadium'),
  trainer('arena2', 'Arena', 'Stadium'),
  trainer('park', 'Park', 'Stadium'),
  trainer('tool', 'Helmet', 'Tool'),
  trainer('picky', 'Picky Item', 'Item'),
];
const scripts: Record<string, CardScript> = {
  sup: { trainer: { play: (ctx) => void ctx.draw(ctx.me, 1) } },
  picky: { trainer: { canPlay: () => false, play: () => {} } },
  park: {
    stadium: {
      canUse: (ctx) => ctx.state.players[ctx.me].hand.length > 0,
      use: (ctx) => void ctx.draw(ctx.me, 1),
    },
  },
};
const engine = createEngine(miniRegistry(defs, scripts));
const deck = {
  't-basic': 20,
  't-dark': 20,
  sup: 4,
  arena: 2,
  arena2: 2,
  park: 4,
  tool: 4,
  picky: 2,
  't-item': 2,
};

function game(turn: 1 | 2): { s: GameState; me: PlayerId; opp: PlayerId } {
  let s = started(engine, deck, deck, 2);
  if (turn === 2) s = act(engine, s, { type: 'endTurn' });
  const me = s.current;
  return { s, me, opp: me === 0 ? 1 : 0 };
}

const play = (uid: string, target?: { player: PlayerId; zone: 'active' }) =>
  target ? ({ type: 'playTrainer', uid, target } as const) : ({ type: 'playTrainer', uid } as const);

describe('Items', () => {
  test('a played Item resolves and goes to the discard pile', () => {
    const { s: s0, me } = game(1);
    const uid = giveCard(s0, me, 't-item');
    const s = act(engine, s0, play(uid));
    expect(s.players[me].hand).not.toContain(uid);
    expect(s.players[me].discard).toContain(uid);
  });

  test('an Item whose canPlay is false is not offered', () => {
    const { s, me } = game(1);
    const uid = giveCard(s, me, 'picky');
    expect(engine.getLegalActions(s, me)).not.toContainEqual(play(uid));
  });
});

describe('Supporters', () => {
  test('the first player cannot play a Supporter on turn 1', () => {
    const { s, me } = game(1);
    const uid = giveCard(s, me, 'sup');
    expect(engine.getLegalActions(s, me)).not.toContainEqual(play(uid));
  });

  test('only one Supporter per turn', () => {
    const { s: s0, me } = game(2);
    const a = giveCard(s0, me, 'sup');
    const b = giveCard(s0, me, 'sup');
    const s = act(engine, s0, play(a));
    expect(s.players[me].supporterTurn).toBe(s.turn);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(play(b));
  });
});

describe('Stadiums', () => {
  test('a new Stadium replaces the one in play, which goes to its owner’s discard pile', () => {
    const { s: s0, me, opp } = game(2);
    const theirs = giveCard(s0, opp, 'arena');
    s0.players[opp].hand.splice(s0.players[opp].hand.indexOf(theirs), 1);
    s0.stadium = { uid: theirs, owner: opp };
    const mine = giveCard(s0, me, 'park');
    const s = act(engine, s0, play(mine));
    expect(s.stadium).toEqual({ uid: mine, owner: me });
    expect(s.players[opp].discard).toContain(theirs);
  });

  test('a Stadium with the same name as the one in play cannot be played', () => {
    const { s, me, opp } = game(2);
    const theirs = giveCard(s, opp, 'arena');
    s.players[opp].hand.splice(s.players[opp].hand.indexOf(theirs), 1);
    s.stadium = { uid: theirs, owner: opp };
    const same = giveCard(s, me, 'arena2');
    expect(engine.getLegalActions(s, me)).not.toContainEqual(play(same));
  });

  test('a Stadium’s effect can be used once per turn by each player', () => {
    const { s: s0, me } = game(2);
    const park = giveCard(s0, me, 'park');
    let s = act(engine, s0, play(park));
    expect(has(engine.getLegalActions(s, me), 'useStadium')).toBe(true);
    s = act(engine, s, { type: 'useStadium' });
    expect(has(engine.getLegalActions(s, me), 'useStadium')).toBe(false);
    s = act(engine, s, { type: 'endTurn' });
    expect(has(engine.getLegalActions(s, s.current), 'useStadium')).toBe(true);
  });
});

describe('Tools', () => {
  test('a Tool attaches to a Pokémon, and a second Tool cannot go on the same Pokémon', () => {
    const { s: s0, me } = game(1);
    const t1 = giveCard(s0, me, 'tool');
    const t2 = giveCard(s0, me, 'tool');
    const target = { player: me, zone: 'active' } as const;
    const s = act(engine, s0, play(t1, target));
    expect(s.players[me].active!.tool).toBe(t1);
    expect(engine.getLegalActions(s, me)).not.toContainEqual(play(t2, target));
  });
});
