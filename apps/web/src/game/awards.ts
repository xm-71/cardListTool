import { useEffect, useState } from 'react';
import type { GameResult, PlayerId } from '@ptcg/engine';
import { creditsFor } from '@ptcg/economy';
import { useProfile, type GymPayout } from '../profile/useProfile.ts';
import { useGame, type GameConfig } from './store.ts';

/** Credits a finished game pays, or null when it pays nothing at all (hotseat). */
export function gameAward(config: GameConfig, result: GameResult, human: PlayerId): number | null {
  // Gym Challenge games are paid by `useGymResult`.
  if (config.mode !== 'bot' || config.context) return null;
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

/** What a finished Gym Challenge game paid: undefined while saving (or for a game that is not a gym game). */
export function useGymResult(): GymPayout | undefined {
  const result = useGame((s) => s.state?.result ?? null);
  const config = useGame((s) => s.config);
  const human = useGame((s) => s.human);
  const [paid, setPaid] = useState<{ seed: number; payout: GymPayout | undefined } | null>(null);
  const context = config?.context;
  const seed = config?.seed;
  useEffect(() => {
    if (!result || !config || !context || seed === undefined) return;
    const won = result.winner === human;
    const profile = useProfile.getState();
    const saved =
      context.kind === 'gym'
        ? profile.recordGym({
            seed,
            leaderId: context.leaderId,
            won,
            normalCredits: creditsFor(result, human, config.difficulty ?? 'easy'),
          })
        : profile.recordElite({
            seed,
            stage: context.stage,
            won,
            deckName: context.deckName,
            cover: context.cover,
          });
    saved
      .then((payout) => setPaid((prev) => (prev?.seed === seed && prev.payout ? prev : { seed, payout })))
      .catch((e: unknown) => console.error('Could not save Gym Challenge progress', e));
    // One save per finished game.
  }, [result !== null, seed]);
  return paid?.seed === seed ? paid?.payout : undefined;
}
