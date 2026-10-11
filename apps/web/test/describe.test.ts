import { describe, expect, test } from 'vitest';
import type { GameEvent, PlayerId } from '@ptcg/engine';
import { describeEvent, opponentName, type Names } from '../src/game/describe.ts';

const owners: Record<string, PlayerId> = { gastly: 0, onix: 1 };
const names: Names = { viewer: 0, opponent: 'Brock', ownerOf: (uid) => owners[uid] };
const say = (e: Partial<GameEvent>) => describeEvent({ type: 'x', text: '', ...e }, names);

describe('describeEvent', () => {
  test('"Player N" becomes You or the opponent, with the verb to match', () => {
    expect(say({ text: 'Player 1 plays Nest Ball' })).toBe('You play Nest Ball');
    expect(say({ text: 'Player 2 plays Nest Ball' })).toBe('Brock plays Nest Ball');
    expect(say({ text: 'Player 1 attaches Darkness Energy to Gastly' })).toBe(
      'You attach Darkness Energy to Gastly',
    );
    expect(say({ text: 'Player 1 takes 2 Prize card(s)' })).toBe('You take 2 Prize card(s)');
    expect(say({ text: 'Player 1 ends their turn' })).toBe('You end your turn');
    expect(say({ text: 'Player 1 wins (prizes)' })).toBe('You win (prizes)');
    expect(say({ text: 'Player 1 wins the coin flip and goes first' })).toBe(
      'You win the coin flip and go first',
    );
    expect(say({ text: 'Player 2 promotes Onix' })).toBe('Brock promotes Onix');
  });

  test('turn starts say whose turn it is', () => {
    expect(say({ type: 'turnStart', player: 0, text: 'Turn 3: Player 1' })).toBe('Turn 3: Your turn');
    expect(say({ type: 'turnStart', player: 1, text: 'Turn 4: Player 2' })).toBe("Turn 4: Brock's turn");
  });

  test("a Pokémon's line says whose Pokémon it is", () => {
    expect(say({ text: 'Onix uses Rock Throw', anim: { kind: 'attack', by: 'onix' } })).toBe(
      "Brock's Onix uses Rock Throw",
    );
    expect(
      say({ text: 'Gastly takes 30 damage', anim: { kind: 'damage', target: 'gastly', amount: 30 } }),
    ).toBe('Your Gastly takes 30 damage');
    expect(say({ text: 'Gastly is Knocked Out', anim: { kind: 'knockout', target: 'gastly' } })).toBe(
      'Your Gastly is Knocked Out',
    );
  });

  test('lines with no player are left as they are', () => {
    expect(say({ text: 'Coin flip: heads' })).toBe('Coin flip: heads');
  });
});

describe('opponentName', () => {
  test('a Gym Leader, an Elite Four member, the other seat in hotseat, else Rival', () => {
    expect(
      opponentName(
        {
          mode: 'bot',
          context: { kind: 'gym', leaderId: 'brock', deck: { kind: 'starter', id: 'x' } } as never,
        },
        0,
      ),
    ).toBe('Brock');
    expect(
      opponentName({ mode: 'bot', context: { kind: 'elite', stage: 0, deckName: 'd', cover: 'c' } }, 0),
    ).toBe('Lorelei');
    expect(opponentName({ mode: 'hotseat' }, 0)).toBe('Player 2');
    expect(opponentName({ mode: 'hotseat' }, 1)).toBe('Player 1');
    expect(opponentName({ mode: 'bot' }, 0)).toBe('Rival');
  });
});
