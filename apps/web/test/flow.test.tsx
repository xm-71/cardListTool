import { act as rtlAct, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { attachFromDeck, benchFromHand, swapActiveTo } from '@ptcg/engine/testing';
import { App } from '../src/App.tsx';
import { createSyncBotClient } from '../src/game/botClient.ts';
import { actorOf, useGame } from '../src/game/store.ts';
import { botCfg, mutate, seedWhereSeat0PromptsFirst } from './helpers.ts';

const bot = createSyncBotClient();
const opts = { timeout: 8000 };

beforeEach(() => useGame.getState().reset());

function renderApp() {
  return render(<App startAt="duel" botClient={bot} botDelayMs={0} />);
}

/** Human (seat 0) answers its own setup prompts through the store until the game leaves setup. */
async function finishHumanSetup() {
  await waitFor(() => {
    const s = useGame.getState().state!;
    if (s.phase === 'setup' && s.prompt?.player === 0) {
      const pr = s.prompt;
      rtlAct(() =>
        useGame.getState().dispatch(0, {
          type: 'answer',
          optionId: pr.selected.length >= pr.min ? 'done' : pr.options[0]!.id,
        }),
      );
    }
    expect(useGame.getState().state!.phase).toBe('main');
  }, opts);
}

async function startBotGame() {
  renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  await finishHumanSetup();
}

const actor = () => actorOf(useGame.getState().state!);

describe('bot games', () => {
  test('the bot completes its own setup', async () => {
    await startBotGame();
    expect(useGame.getState().state!.players[1].active).not.toBeNull();
  });

  test('after the human ends their turn the bot plays until it is the human’s turn again', async () => {
    await startBotGame();
    await waitFor(() => expect(actor() === 0 || useGame.getState().state!.result).toBeTruthy(), opts);
    const turn = useGame.getState().state!.turn;
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }));
    await waitFor(() => {
      const s = useGame.getState().state!;
      expect(s.result !== null || (actorOf(s) === 0 && s.turn === turn + 2)).toBe(true);
    }, opts);
  });

  test('when the human Knocks Out the bot’s Active, the bot promotes and play comes back to the human', async () => {
    await startBotGame();
    await waitFor(() => expect(actor()).toBe(0), opts);
    mutate((s) => {
      swapActiveTo(s, 0, 'me02-056'); // Mega Gengar ex, Void Gale 230
      attachFromDeck(s, 0, 'mee-007');
      attachFromDeck(s, 0, 'mee-007');
      const opp = s.players[1];
      while (opp.bench.length < 2) {
        const basic = opp.deck.find((u) =>
          ['me02-040', 'me02-042', 'me01-062', 'me02-043'].includes(s.cards[u]!.defId),
        )!;
        opp.deck.splice(opp.deck.indexOf(basic), 1);
        opp.hand.push(basic);
        benchFromHand(s, 1, basic);
      }
    });
    rtlAct(() => useGame.getState().dispatch(0, { type: 'attack', attackIndex: 0 }));
    await waitFor(() => {
      const s = useGame.getState().state!;
      expect(s.result !== null || (actorOf(s) === 0 && s.players[1].active !== null)).toBe(true);
    }, opts);
  });
});

describe('hotseat', () => {
  test('passing between players hides the board until the next player is ready', async () => {
    // a seed where seat 0 is prompted first and seat 1 gets its own setup prompt afterwards
    const seed = seedWhereSeat0PromptsFirst();
    useGame.getState().start({ ...botCfg(seed), mode: 'hotseat' });
    renderApp();
    const first = actor()!;
    expect(first).toBe(0);
    expect(screen.getByText(`Pass to Player ${first + 1}`)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your hand' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
    expect(screen.getByRole('region', { name: 'Your hand' })).toBeInTheDocument();
    // answer the first player's setup prompts until the prompt moves to the other seat
    for (let i = 0; i < 10 && actor() === first && useGame.getState().state!.prompt; i++) {
      const pr = useGame.getState().state!.prompt!;
      rtlAct(() =>
        useGame.getState().dispatch(first, {
          type: 'answer',
          optionId: pr.selected.length >= pr.min ? 'done' : pr.options[0]!.id,
        }),
      );
    }
    expect(actor()).not.toBe(first);
    expect(screen.getByText(`Pass to Player ${actor()! + 1}`)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your hand' })).toBeNull();
  });
});

describe('game over', () => {
  test('shows the result, offers no moves, and "Play again" starts a new game', async () => {
    await startBotGame();
    await waitFor(() => expect(actor()).toBe(0), opts);
    rtlAct(() => useGame.getState().dispatch(0, { type: 'concede' }));
    expect(screen.getByText('You lose')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull();
    const finished = useGame.getState().state;
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    const fresh = useGame.getState().state!;
    expect(fresh).not.toBe(finished);
    expect(fresh.result).toBeNull();
    expect(fresh.turn).toBeLessThanOrEqual(1); // setup, or turn 1 if nobody had a setup choice
    expect(useGame.getState().actions).toEqual([]);
    expect(screen.queryByText('You lose')).toBeNull();
  });

  test('an unexpected error shows a recovery screen with a bug report download', async () => {
    await startBotGame();
    rtlAct(() => useGame.setState({ error: 'TypeError: boom' }));
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download bug report' })).toBeInTheDocument();
  });
});
