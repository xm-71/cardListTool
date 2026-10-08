import { useEffect } from 'react';
import type { GameResult, PlayerId } from '@ptcg/engine';
import { creditsFor } from '@ptcg/economy';
import { useProfile } from '../profile/useProfile.ts';
import { useGame, type GameConfig } from './store.ts';

/** Credits a finished game pays, or null when it pays nothing at all (hotseat). */
export function gameAward(config: GameConfig, result: GameResult, human: PlayerId): number | null {
  if (config.mode !== 'bot') return null;
  return creditsFor(result, human, config.difficulty ?? 'easy');
}

/** Awards a finished bot game's credits once (keyed by its seed) and returns the amount to show. */
export function useGameAward(): number | null {
  const result = useGame((s) => s.state?.result ?? null);
  const config = useGame((s) => s.config);
  const human = useGame((s) => s.human);
  const amount = result && config ? gameAward(config, result, human) : null;
  const seed = config?.seed;
  useEffect(() => {
    if (amount === null || seed === undefined) return;
    // A failed save leaves the profile unchanged; there is nothing more useful to do mid-game.
    useProfile
      .getState()
      .award(seed, amount)
      .catch((e: unknown) => console.error('Could not save credits', e));
  }, [amount, seed]);
  return amount;
}
