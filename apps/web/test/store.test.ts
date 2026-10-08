import { beforeEach, describe, expect, test } from 'vitest';
import { deckById } from '../src/game/catalog.ts';
import { actorOf, useGame } from '../src/game/store.ts';

const cfg = {
  mode: 'bot' as const,
  humanDeck: deckById('mega-gengar').list,
  botDeck: deckById('mega-diancie').list,
  seed: 7,
};

beforeEach(() => useGame.getState().reset());

describe('game store', () => {
  test('start creates a game in setup, and the actor is the prompted player', () => {
    useGame.getState().start(cfg);
    const { state } = useGame.getState();
    expect(state?.phase).toBe('setup');
    expect(state?.prompt).not.toBeNull();
    expect(actorOf(state!)).toBe(state!.prompt!.player);
  });

  test('dispatching a legal answer advances the game and is recorded', () => {
    useGame.getState().start(cfg);
    const before = useGame.getState().state!;
    const player = before.prompt!.player;
    const action = { type: 'answer', optionId: before.prompt!.options[0]!.id } as const;
    useGame.getState().dispatch(player, action);
    expect(useGame.getState().state).not.toBe(before);
    expect(useGame.getState().actions).toEqual([{ player, action }]);
  });

  test('an illegal action is ignored without changing state or reporting an error', () => {
    useGame.getState().start(cfg);
    const before = useGame.getState().state;
    useGame.getState().dispatch(before!.prompt!.player, { type: 'endTurn' });
    expect(useGame.getState().state).toBe(before);
    expect(useGame.getState().error).toBeNull();
    expect(useGame.getState().actions).toEqual([]);
  });

  test('an unexpected engine error is stored, not thrown', () => {
    useGame.getState().start(cfg);
    const s = useGame.getState().state!;
    // corrupt the paused effect's snapshot so replaying it throws a TypeError
    const snapshot = { ...s.pending!.snapshot, players: [] as never };
    useGame.setState({ state: { ...s, pending: { ...s.pending!, snapshot } } });
    useGame.getState().dispatch(s.prompt!.player, { type: 'answer', optionId: s.prompt!.options[0]!.id });
    expect(useGame.getState().error).toEqual(expect.any(String));
  });

  test('actorOf is null once the game is over', () => {
    useGame.getState().start(cfg);
    const s = useGame.getState().state!;
    expect(actorOf({ ...s, prompt: null, result: { winner: 0, reason: 'concede' } })).toBeNull();
  });
});
