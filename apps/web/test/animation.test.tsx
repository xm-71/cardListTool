import { fireEvent, render, screen, within } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { GameEvent, GameState } from '@ptcg/engine';
import { beatMs, beatsFor, type Beat } from '../src/game/animation/beats.ts';
import { present, setBeatRunner, useAnim } from '../src/game/animation/director.ts';
import type { BotClient } from '../src/game/botClient.ts';
import { useGame } from '../src/game/store.ts';
import { useBotDriver } from '../src/game/useBotDriver.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { Options } from '../src/screens/Options.tsx';
import { animationDefault, useSettings } from '../src/settings/useSettings.ts';
import { botCfg, finishSetupInStore, turnOf } from './helpers.ts';

const ev = (e: Partial<GameEvent> & { type: string }): GameEvent => ({ text: e.type, ...e });

describe('beatsFor', () => {
  test('a turn start is a banner and a draw for that player', () => {
    expect(beatsFor([ev({ type: 'turnStart', player: 1, text: 'Turn 3: Player 2' })]).map((b) => b.kind)).toEqual([
      'turn',
      'draw',
    ]);
  });

  test('an attack aims at the Pokémon its damage lands on, then damage, Knock Out, Prize and promote follow', () => {
    const beats = beatsFor([
      ev({ type: 'attack', anim: { kind: 'attack', by: 'a' } }),
      ev({ type: 'damage', anim: { kind: 'damage', target: 'd', amount: 30 } }),
      ev({ type: 'knockout', anim: { kind: 'knockout', target: 'd' } }),
      ev({ type: 'prize', anim: { kind: 'prize', player: 0, count: 1 } }),
      ev({ type: 'promote', anim: { kind: 'promote', target: 'b', player: 1 } }),
    ]);
    expect(beats.map((b) => b.kind)).toEqual(['attack', 'damage', 'knockout', 'prize', 'promote']);
    expect(beats[0]).toMatchObject({ kind: 'attack', by: 'a', target: 'd' });
  });

  test('events with nothing to animate become text-only notes that take no time', () => {
    const [note] = beatsFor([ev({ type: 'playBasic', text: 'Player 1 plays Gastly' })]);
    expect(note).toEqual({ kind: 'note', text: 'Player 1 plays Gastly' });
    expect(beatMs(note!)).toBe(0);
  });

  test('every animated beat takes some time', () => {
    const kinds: Beat[] = beatsFor([
      ev({ type: 'turnStart', player: 0 }),
      ev({ type: 'x', anim: { kind: 'energy', uid: 'e', target: 't' } }),
      ev({ type: 'x', anim: { kind: 'evolve', uid: 'e', target: 't' } }),
      ev({ type: 'x', anim: { kind: 'bench', uid: 'e', player: 0 } }),
      ev({ type: 'x', anim: { kind: 'trainer', uid: 'e', player: 0 } }),
      ev({ type: 'x', anim: { kind: 'coin', heads: true } }),
      ev({ type: 'x', anim: { kind: 'retreat', from: 'a', to: 'b', player: 0 } }),
      ev({ type: 'x', anim: { kind: 'condition', target: 't', condition: 'poisoned' } }),
      ev({ type: 'x', anim: { kind: 'checkup', target: 't', condition: 'burned', amount: 20 } }),
    ]);
    for (const b of kinds) expect(beatMs(b), b.kind).toBeGreaterThan(0);
  });
});

describe('the director', () => {
  let played: Beat[];
  beforeEach(() => {
    vi.useFakeTimers();
    played = [];
    useSettings.setState({ animations: 'normal' });
    useAnim.getState().reset();
    setBeatRunner(async (beat, ms) => {
      played.push(beat);
      await new Promise((r) => setTimeout(r, ms));
    });
  });
  afterEach(() => {
    setBeatRunner(null);
    vi.useRealTimers();
  });

  const base = { log: [ev({ type: 'turnStart', player: 0 })] } as unknown as GameState;
  const next = {
    log: [
      ...base.log,
      ev({ type: 'attack', anim: { kind: 'attack', by: 'a' } }),
      ev({ type: 'damage', anim: { kind: 'damage', target: 'd', amount: 30 } }),
    ],
  } as unknown as GameState;

  test('keeps showing the old state while beats play, then shows the new one', async () => {
    present(base);
    expect(useAnim.getState().shown).toBe(base);
    present(next);
    expect(useAnim.getState().busy).toBe(true);
    expect(useAnim.getState().shown).toBe(base);
    await act(() => vi.runAllTimersAsync());
    expect(played.map((b) => b.kind)).toEqual(['attack', 'damage']);
    expect(useAnim.getState().shown).toBe(next);
    expect(useAnim.getState().busy).toBe(false);
  });

  test('the current beat is shared (for the ticker) while it plays', async () => {
    present(base);
    present(next);
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(useAnim.getState().beat?.kind).toBe('attack');
  });

  test('with animations Off the new state shows at once', () => {
    useSettings.setState({ animations: 'off' });
    present(base);
    present(next);
    expect(useAnim.getState().shown).toBe(next);
    expect(played).toEqual([]);
  });

  test('a state that does not continue the last one (a new game) shows at once', () => {
    present(next);
    const other = { log: [ev({ type: 'setup', text: 'new game' })] } as unknown as GameState;
    present(other);
    expect(useAnim.getState().shown).toBe(other);
  });

  test('Fast plays the same beats in less time', async () => {
    useSettings.setState({ animations: 'fast' });
    const times: number[] = [];
    setBeatRunner(async (_b, ms) => {
      times.push(ms);
    });
    present(base);
    present(next);
    await act(() => vi.runAllTimersAsync());
    const normal = beatsFor(next.log.slice(1)).map(beatMs);
    expect(times).toEqual(normal.map((ms) => ms * 0.4));
  });

  test('the bot waits while beats play', async () => {
    useGame.getState().reset();
    useGame.getState().start(botCfg(1));
    finishSetupInStore();
    turnOf(1); // the bot's turn
    const choose = vi.fn(() => new Promise<never>(() => {}));
    function Driver() {
      useBotDriver({ choose } as unknown as BotClient, 0);
      return null;
    }
    useAnim.setState({ busy: true });
    render(<Driver />);
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(choose).not.toHaveBeenCalled();
    act(() => useAnim.setState({ busy: false }));
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(choose).toHaveBeenCalled();
  });
});

describe('the animation setting', () => {
  test('is Normal by default, and Off on devices that ask for reduced motion', () => {
    expect(animationDefault(false)).toBe('normal');
    expect(animationDefault(true)).toBe('off');
  });

  test('Options has Normal, Fast and Off, and the choice is remembered', async () => {
    localStorage.clear();
    useSettings.setState({ animations: 'normal' });
    useProfile.getState().reset();
    await useProfile.getState().init(createMemoryStore({ ...newProfile(), introDone: true }), true);
    render(<Options />);
    const group = screen.getByRole('radiogroup', { name: 'Battle animations' });
    expect(within(group).getByRole('radio', { name: 'Normal' })).toBeChecked();
    fireEvent.click(within(group).getByRole('radio', { name: 'Fast' }));
    expect(useSettings.getState().animations).toBe('fast');
    expect(JSON.parse(localStorage.getItem('ptcg.settings')!).animations).toBe('fast');
    fireEvent.click(within(group).getByRole('radio', { name: 'Off' }));
    expect(useSettings.getState().animations).toBe('off');
  });
});
