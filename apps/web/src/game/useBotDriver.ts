import { useEffect, useRef } from 'react';
import type { PlayerId } from '@ptcg/engine';
import type { BotClient } from './botClient.ts';
import { engine } from './catalog.ts';
import { actorOf, useGame } from './store.ts';

/** Whenever the bot seat must act (its turn, or a prompt during the human's turn), ask the bot and play its move. */
export function useBotDriver(client: BotClient, delayMs: number): void {
  const state = useGame((s) => s.state);
  const mode = useGame((s) => s.config?.mode);
  const seed = useGame((s) => s.config?.seed);
  const human = useGame((s) => s.human);
  const rng = useRef(0);
  const seq = useRef(0);

  useEffect(() => {
    rng.current = ((seed ?? 0) ^ 0x5bd1e995) >>> 0;
  }, [seed]);

  useEffect(() => {
    if (!state || mode !== 'bot') return;
    const botSeat: PlayerId = human === 0 ? 1 : 0;
    if (actorOf(state) !== botSeat) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      const legal = engine.getLegalActions(state, botSeat);
      if (legal.length === 0) {
        useGame.setState({ error: 'The bot has no legal move although it must act.' });
        return;
      }
      try {
        const { action, rng: next } = await client.choose(engine.viewFor(state, botSeat), legal, rng.current);
        // Drop the reply if the game moved on meanwhile (new game, reset, or a newer request).
        if (mine !== seq.current || useGame.getState().state !== state) return;
        rng.current = next;
        useGame.getState().dispatch(botSeat, action);
      } catch (e) {
        if (mine !== seq.current) return;
        useGame.setState({ error: `Bot error: ${e instanceof Error ? e.message : String(e)}` });
      }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [state, mode, human, client, delayMs]);
}
