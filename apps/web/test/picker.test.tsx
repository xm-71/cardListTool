import { act as rtlAct, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import type { SlotView as SlotViewData } from '@ptcg/engine';
import { App } from '../src/App.tsx';
import type { BotClient, BotSetup } from '../src/game/botClient.ts';
import { createSyncBotClient } from '../src/game/botClient.ts';
import { useGame } from '../src/game/store.ts';
import { SlotView } from '../src/ui/SlotView.tsx';

beforeEach(() => useGame.getState().reset());

describe('Home deck picker', () => {
  test('offers all three decks for each side and allows a mirror match', () => {
    render(<App botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
    const yours = screen.getByRole('group', { name: 'Your deck' });
    const theirs = screen.getByRole('group', { name: "Opponent's deck" });
    for (const g of [yours, theirs]) expect(within(g).getAllByRole('button')).toHaveLength(3);
    fireEvent.click(within(yours).getByRole('button', { name: /Mega Lucario ex/ }));
    fireEvent.click(within(theirs).getByRole('button', { name: /Mega Lucario ex/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    const { config, state } = useGame.getState();
    expect(config).toMatchObject({ humanDeck: 'mega-lucario', botDeck: 'mega-lucario' });
    const owners = new Set(
      Object.values(state!.cards)
        .filter((c) => c.defId === 'me01-077')
        .map((c) => c.owner),
    );
    expect(owners).toEqual(new Set([0, 1]));
  });

  test('choosing the Medium bot sends its difficulty, decks and seat to the bot', async () => {
    const seen: BotSetup[] = [];
    const sync = createSyncBotClient();
    const spy: BotClient = {
      choose: (view, legal, rng, setup) => {
        seen.push(setup);
        return sync.choose(view, legal, rng, setup);
      },
    };
    render(<App botClient={spy} botDelayMs={0} />);
    fireEvent.click(screen.getByLabelText('Medium bot'));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(
      () => {
        const st = useGame.getState().state!;
        if (st.prompt?.player === 0) {
          const pr = st.prompt;
          rtlAct(() =>
            useGame.getState().dispatch(0, {
              type: 'answer',
              optionId: pr.selected.length >= pr.min ? 'done' : pr.options[0]!.id,
            }),
          );
        } else if (st.phase === 'main' && st.current === 0 && !st.prompt) {
          rtlAct(() => useGame.getState().dispatch(0, { type: 'endTurn' }));
        }
        expect(seen.length).toBeGreaterThan(0);
      },
      { timeout: 15000 },
    );
    expect(seen[0]).toMatchObject({ difficulty: 'medium', seat: 1 });
    expect(seen[0]!.decks).toHaveLength(2);
  }, 20000);
});

describe('SlotView', () => {
  test('uses the effective max HP from the view (e.g. under Gravity Mountain)', () => {
    const slot: SlotViewData = {
      stack: [{ uid: 'x', defId: 'me02-056', owner: 0 }],
      energy: [],
      tool: null,
      damage: 20,
      conditions: { rotation: 'none', poisoned: false, burned: false },
      enteredTurn: 0,
      evolvedTurn: null,
      abilityUsedTurn: {},
      cantAttackOnTurn: null,
      attackLocks: {},
      hp: 320,
    };
    render(<SlotView slot={slot} />);
    expect(screen.getByText('300/320')).toBeInTheDocument();
  });
});
