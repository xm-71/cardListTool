import { act as rtlAct, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import type { SlotView as SlotViewData } from '@ptcg/engine';
import { megaLucarioDeck, megaVenusaurDeck } from '@ptcg/cards';
import { createEngine } from '@ptcg/engine';
import { App } from '../src/App.tsx';
import { registry } from '../src/game/catalog.ts';
import type { BotClient, BotSetup } from '../src/game/botClient.ts';
import { botFor, createSyncBotClient } from '../src/game/botClient.ts';
import { useGame } from '../src/game/store.ts';
import { SlotView } from '../src/ui/SlotView.tsx';
import { ownEveryDeck } from './helpers.ts';

beforeEach(async () => {
  useGame.getState().reset();
  await ownEveryDeck();
});

describe('Home deck picker', () => {
  test('groups decks into Starter decks (3) and Theme decks (6), with no Custom section when there are none', () => {
    render(<App startAt="duel" botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
    fireEvent.click(screen.getByLabelText(/Hotseat/)); // the second deck is only chosen by a second player
    // Player 1 plays the active deck; only the opponent's deck is a tile picker.
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    const g = screen.getByRole('group', { name: "Opponent's deck" });
    expect(
      within(within(g).getByRole('group', { name: 'Starter decks' })).getAllByRole('button'),
    ).toHaveLength(3);
    expect(within(within(g).getByRole('group', { name: 'Theme decks' })).getAllByRole('button')).toHaveLength(
      6,
    );
    expect(within(g).queryByRole('group', { name: 'Custom decks' })).toBeNull();
  });

  test('a theme deck can be picked for both sides', async () => {
    await ownEveryDeck({ activeDeck: 'mega-venusaur' });
    render(<App startAt="duel" botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
    fireEvent.click(screen.getByLabelText(/Hotseat/));
    fireEvent.click(
      within(screen.getByRole('group', { name: "Opponent's deck" })).getByRole('button', {
        name: /Mega Venusaur ex/,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    const { config, state } = useGame.getState();
    expect(config).toMatchObject({ humanDeck: megaVenusaurDeck, botDeck: megaVenusaurDeck });
    const owners = new Set(
      Object.values(state!.cards)
        .filter((c) => c.defId === 'me01-003')
        .map((c) => c.owner),
    );
    expect(owners).toEqual(new Set([0, 1]));
  });

  test('allows a starter-deck mirror match', async () => {
    await ownEveryDeck({ activeDeck: 'mega-lucario' });
    render(<App startAt="duel" botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
    fireEvent.click(screen.getByLabelText(/Hotseat/));
    const theirs = screen.getByRole('group', { name: "Opponent's deck" });
    fireEvent.click(within(theirs).getByRole('button', { name: /Mega Lucario ex/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    const { config, state } = useGame.getState();
    expect(config).toMatchObject({ humanDeck: megaLucarioDeck, botDeck: megaLucarioDeck });
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
    render(<App startAt="duel" botClient={spy} botDelayMs={0} />);
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

  test('choosing the Hard bot sends difficulty "hard", decks and seat to the bot', async () => {
    const seen: BotSetup[] = [];
    const sync = createSyncBotClient();
    const spy: BotClient = {
      choose: (view, legal, rng, setup) => {
        seen.push(setup);
        // Answer with the cheap bot: this test is about what is sent, not how long Hard thinks.
        return sync.choose(view, legal, rng, { ...setup, difficulty: 'easy' });
      },
    };
    render(<App startAt="duel" botClient={spy} botDelayMs={0} />);
    fireEvent.click(screen.getByLabelText('Hard bot'));
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
    expect(seen[0]).toMatchObject({ difficulty: 'hard', seat: 1 });
    expect(seen[0]!.decks).toHaveLength(2);
  }, 20000);

  test('botFor builds a Hard bot that picks a legal move', () => {
    const engine = createEngine(registry);
    const decks: [typeof megaLucarioDeck, typeof megaLucarioDeck] = [megaLucarioDeck, megaLucarioDeck];
    let s = engine.createGame({ decks, seed: 3 });
    const player = s.prompt ? s.prompt.player : s.current;
    const legal = engine.getLegalActions(s, player);
    const bot = botFor()({ difficulty: 'hard', decks, seat: player });
    const out = bot(engine.viewFor(s, player), legal, 5);
    expect(legal).toContainEqual(out.action);
    s = engine.applyAction(s, player, out.action).state;
    expect(s).toBeDefined();
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
      markers: [],
      becameActiveTurn: null,
      hp: 320,
    };
    render(<SlotView slot={slot} />);
    expect(screen.getByText('300/320')).toBeInTheDocument();
  });
});
