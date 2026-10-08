import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { giveCard } from '@ptcg/engine/testing';
import { registry } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { GameScreen } from '../src/screens/GameScreen.tsx';
import { botCfg, finishSetupInStore, mutate, seedWhereSeat0PromptsFirst, turnOf } from './helpers.ts';

beforeEach(() => useGame.getState().reset());

describe('GameScreen', () => {
  test('the setup prompt shows the human’s Basic Pokémon, and clicking one answers it', () => {
    useGame.getState().start(botCfg(seedWhereSeat0PromptsFirst()));
    const before = useGame.getState().state!;
    render(<GameScreen />);
    const panel = screen.getByRole('dialog', { name: /Choose your Active Pokémon/ });
    const first = before.prompt!.options[0]!;
    const name = registry.defs[before.cards[first.uid!]!.defId]!.name;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 1000); // past the prompt's double-click guard
    fireEvent.click(within(panel).getAllByRole('img', { name })[0]!);
    vi.useRealTimers();
    expect(useGame.getState().state).not.toBe(before);
    expect(useGame.getState().actions[0]).toEqual({
      player: 0,
      action: { type: 'answer', optionId: first.id },
    });
  });

  test('clicking a Basic in hand offers "Play <name>", which puts it on the Bench', () => {
    useGame.getState().start(botCfg(1));
    finishSetupInStore();
    turnOf(0);
    let uid = '';
    mutate((s) => {
      uid = giveCard(s, 0, 'me02-062'); // Seviper
    });
    render(<GameScreen />);
    const hand = screen.getByRole('region', { name: 'Your hand' });
    const card = within(hand)
      .getAllByRole('button')
      .find((b) => b.getAttribute('data-uid') === uid)!;
    fireEvent.click(card);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Play Seviper' }));
    expect(useGame.getState().state!.players[0].bench.map((b) => b.stack[0])).toContain(uid);
  });

  test("the opponent's hand is shown only as a count", () => {
    useGame.getState().start(botCfg(1));
    finishSetupInStore();
    render(<GameScreen />);
    const s = useGame.getState().state!;
    const nameOf = (u: string) => registry.defs[s.cards[u]!.defId]!.name;
    const slots = (p: 0 | 1) =>
      [s.players[p].active!, ...s.players[p].bench].flatMap((sl) => [...sl.stack, ...sl.energy]);
    const visible = new Set([...s.players[0].hand, ...slots(0), ...slots(1)].map(nameOf));
    const oppOnly = s.players[1].hand.map(nameOf).filter((n) => !visible.has(n));
    expect(oppOnly.length).toBeGreaterThan(0);
    const region = screen.getByRole('region', { name: 'Opponent' });
    expect(within(region).getByText(`${s.players[1].hand.length} cards in hand`)).toBeInTheDocument();
    for (const n of oppOnly) expect(screen.queryByRole('img', { name: n })).toBeNull();
  });
});
