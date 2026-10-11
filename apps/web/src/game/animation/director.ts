import { useLayoutEffect } from 'react';
import { create } from 'zustand';
import type { GameState, PlayerId } from '@ptcg/engine';
import { useSettings } from '../../settings/useSettings.ts';
import { useGame } from '../store.ts';
import { beatMs, beatsFor, type Beat } from './beats.ts';
import { canAnimate, domRunner, stopAll } from './effects.ts';

/** Plays one beat on the board; resolves when it is done. */
export type BeatRunner = (beat: Beat, ms: number, viewer: PlayerId) => Promise<void>;

interface AnimState {
  /** The state the board draws: the last one whose beats have all played. */
  shown: GameState | null;
  /** The newest state handed to the director. */
  target: GameState | null;
  /** Beats are playing: the board takes no input and the bot waits. */
  busy: boolean;
  /** The beat playing now (the ticker reads it). */
  beat: Beat | null;
  /** Whose side the board is drawn from. */
  viewer: PlayerId;
  /** Extra speed-up for the beats still to play (Skip); 1 = none. */
  rush: number;
  reset(): void;
}

let queue: Promise<void> = Promise.resolve();
let pending = 0;
let generation = 0;
let override: BeatRunner | null = null;

export const useAnim = create<AnimState>()((set) => ({
  shown: null,
  target: null,
  busy: false,
  beat: null,
  viewer: 0,
  rush: 1,
  reset() {
    generation++;
    pending = 0;
    queue = Promise.resolve();
    stopAll();
    set({ shown: null, target: null, busy: false, beat: null, rush: 1 });
  },
}));

/** Tests replace the DOM runner; `null` puts it back. */
export function setBeatRunner(runner: BeatRunner | null): void {
  override = runner;
}

const SPEED = { normal: 1, fast: 0.4, off: 0 } as const;

/** Whether `next` is `prev` with more moves made (and not, say, a new game). */
function continues(prev: GameState, next: GameState): boolean {
  const n = prev.log.length;
  if (next.log.length < n) return false;
  return n === 0 || next.log[n - 1]?.text === prev.log[n - 1]?.text;
}

/**
 * Hand the director the newest game state. If it follows on from the last one, the board keeps drawing the old
 * state while the new moves' beats play, then shows the new one; otherwise (or with animations Off) it shows at once.
 */
export function present(next: GameState | null): void {
  const { target } = useAnim.getState();
  if (next === target) return;
  if (!next) {
    useAnim.getState().reset();
    return;
  }
  useAnim.setState({ target: next });
  const beats = target && continues(target, next) ? beatsFor(next.log.slice(target.log.length)) : [];
  const runner = override ?? (canAnimate() ? domRunner : null);
  const speed = SPEED[useSettings.getState().animations];
  const timed = !!runner && speed > 0 && beats.some((b) => beatMs(b) > 0);
  if (!timed && pending === 0) {
    useAnim.setState({ shown: next });
    return;
  }
  pending++;
  useAnim.setState({ busy: true });
  const gen = generation;
  const finish = () => {
    if (gen !== generation) return;
    stopAll();
    pending--;
    useAnim.setState({
      shown: next,
      beat: null,
      busy: pending > 0,
      rush: pending > 0 ? useAnim.getState().rush : 1,
    });
  };
  queue = queue
    .then(async () => {
      if (!timed || !runner) return;
      for (const beat of beats) {
        if (gen !== generation) return;
        useAnim.setState({ beat });
        const ms = beatMs(beat) * SPEED[useSettings.getState().animations] * useAnim.getState().rush;
        if (ms > 0) await runner(beat, ms, useAnim.getState().viewer);
      }
    })
    .catch(() => undefined)
    .then(finish);
}

/**
 * The game state to draw: the live one, held back while its moves animate. The board passes its `viewer` (whose
 * turn banners say "Your turn").
 */
export function useShownState(viewer?: PlayerId): GameState | null {
  const state = useGame((s) => s.state);
  const shown = useAnim((s) => s.shown);
  useLayoutEffect(() => {
    if (viewer !== undefined) useAnim.setState({ viewer });
    present(state);
  }, [state, viewer]);
  return state && shown ? shown : state;
}
