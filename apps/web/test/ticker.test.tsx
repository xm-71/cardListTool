import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { GameEvent, GameState } from '@ptcg/engine';
import { present, setBeatRunner, useAnim } from '../src/game/animation/director.ts';
import type { Names } from '../src/game/describe.ts';
import { useSettings } from '../src/settings/useSettings.ts';
import { Ticker } from '../src/ui/Ticker.tsx';

const names: Names = { viewer: 0, opponent: 'Brock', ownerOf: (uid) => (uid === 'onix' ? 1 : 0) };
const ev = (e: Partial<GameEvent> & { type: string }): GameEvent => ({ text: e.type, ...e });
const state = (log: GameEvent[], current: 0 | 1) => ({ log, current }) as unknown as GameState;

const start = state([ev({ type: 'turnStart', player: 0, text: 'Turn 1: Player 1' })], 0);
const theirTurn = state(
  [
    ...start.log,
    ev({ type: 'turnStart', player: 1, text: 'Turn 2: Player 2' }),
    ev({ type: 'attack', text: 'Onix uses Rock Throw', anim: { kind: 'attack', by: 'onix' } }),
    ev({
      type: 'damage',
      text: 'Gastly takes 30 damage',
      anim: { kind: 'damage', target: 'gastly', amount: 30 },
    }),
  ],
  1,
);

let times: number[];
beforeEach(() => {
  vi.useFakeTimers();
  times = [];
  useSettings.setState({ animations: 'normal' });
  useAnim.getState().reset();
  setBeatRunner(async (_b, ms) => {
    times.push(ms);
    await new Promise((r) => setTimeout(r, ms));
  });
});
afterEach(() => {
  setBeatRunner(null);
  vi.useRealTimers();
});

describe('the ticker', () => {
  test('says the turn when nothing is playing', () => {
    render(<Ticker status="Turn 1 · Your turn" names={names} />);
    expect(screen.getByRole('status')).toHaveTextContent('Turn 1 · Your turn');
  });

  test('reads out each move in plain words as it plays', async () => {
    render(<Ticker status="Turn 1 · Your turn" names={names} />);
    act(() => {
      present(start);
      present(theirTurn);
    });
    await act(() => vi.advanceTimersByTimeAsync(5));
    expect(screen.getByRole('status')).toHaveTextContent("Turn 2: Brock's turn");
    await act(() => vi.advanceTimersByTimeAsync(1100 + 400 + 10));
    expect(screen.getByRole('status')).toHaveTextContent("Brock's Onix uses Rock Throw");
    await act(() => vi.runAllTimersAsync());
    expect(screen.getByRole('status')).toHaveTextContent('Turn 1 · Your turn');
  });

  test("Skip plays the rest of the opponent's turn five times faster", async () => {
    render(<Ticker status="s" names={names} />);
    act(() => {
      present(start);
      present(theirTurn);
    });
    fireEvent.click(screen.getByRole('button', { name: /Skip/ }));
    await act(() => vi.runAllTimersAsync());
    // Turn banner, draw, attack, damage, all at a fifth of their Normal time.
    expect(times).toEqual([1100, 400, 500, 800].map((ms) => ms * 0.2));
    expect(useAnim.getState().rush).toBe(1);
    expect(screen.queryByRole('button', { name: /Skip/ })).toBeNull();
  });

  test('has a Log button when asked for one', () => {
    const onLog = vi.fn();
    render(<Ticker status="s" names={names} onLog={onLog} />);
    fireEvent.click(screen.getByRole('button', { name: 'Log' }));
    expect(onLog).toHaveBeenCalled();
  });
});
