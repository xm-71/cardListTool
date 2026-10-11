import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { giveCard } from '@ptcg/engine/testing';
import { registry } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { useNav } from '../src/nav/useNav.ts';
import { GameScreen } from '../src/screens/GameScreen.tsx';
import { botCfg, finishSetupInStore, mutate, turnOf } from './helpers.ts';

const phone = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('max-width'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
const st = () => useGame.getState().state!;
const nameOf = (uid: string) => registry.defs[st().cards[uid]!.defId]!.name;
const you = () => screen.getByRole('region', { name: /^You$/ });
const opponent = () => screen.getByRole('region', { name: 'Opponent' });
const hand = () => screen.getByRole('region', { name: 'Your hand' });
const handCard = (uid: string) => hand().querySelector(`[data-uid="${uid}"]`) as HTMLElement;
const activeOf = (region: HTMLElement, player: 0 | 1) =>
  region.querySelector(`[data-uid="${st().players[player].active!.stack.at(-1)}"]`) as HTMLElement;

/** Give your Active enough Energy of its attack's type to attack. */
function energise() {
  mutate((s) => {
    const active = s.players[0].active!;
    const type = (registry.defs[s.cards[active.stack[0]!]!.defId] as { attacks: { cost: string[] }[] })
      .attacks[0]!.cost[0]!;
    const id = type === 'Darkness' ? 'mee-007' : 'mee-005';
    for (let i = 0; i < 4; i++) {
      const uid = giveCard(s, 0, id);
      s.players[0].hand = s.players[0].hand.filter((u) => u !== uid);
      active.energy.push(uid);
    }
  });
}

beforeEach(() => {
  localStorage.clear();
  phone();
  useGame.getState().reset();
  useGame.getState().start(botCfg(1));
  finishSetupInStore();
  turnOf(0);
});
afterEach(() => vi.unstubAllGlobals());

describe('the Face-off board on a phone', () => {
  test('shows both Active Pokémon, the opponent hand count, and your whole hand without a Hand button', () => {
    render(<GameScreen />);
    expect(activeOf(opponent(), 1)).toBeInTheDocument();
    expect(activeOf(you(), 0)).toBeInTheDocument();
    expect(within(opponent()).getByText(`Hand ${st().players[1].hand.length}`)).toBeInTheDocument();
    for (const uid of st().players[0].hand) expect(handCard(uid)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Hand \d+$/ })).toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Game controls' })).toBeNull();
  });

  test('tapping an Energy card makes your Pokémon glow; tapping one attaches it', () => {
    let dark = '';
    mutate((s) => {
      dark = giveCard(s, 0, 'mee-007');
    });
    render(<GameScreen />);
    fireEvent.click(handCard(dark));
    const active = activeOf(you(), 0);
    expect(active).toHaveAttribute('data-target');
    fireEvent.click(active);
    expect(st().players[0].active!.energy).toContain(dark);
    expect(you().querySelector('[data-target]')).toBeNull();
  });

  test('tapping the same hand card again puts it down', () => {
    let dark = '';
    mutate((s) => {
      dark = giveCard(s, 0, 'mee-007');
    });
    render(<GameScreen />);
    fireEvent.click(handCard(dark));
    fireEvent.click(handCard(dark));
    expect(you().querySelector('[data-target]')).toBeNull();
  });

  test('a Basic Pokémon goes to the glowing Bench space or through its Play button', () => {
    let a = '';
    let b = '';
    mutate((s) => {
      a = giveCard(s, 0, 'me02-062'); // Seviper
      b = giveCard(s, 0, 'me02-054'); // Gastly
    });
    render(<GameScreen />);
    fireEvent.click(handCard(a));
    fireEvent.click(within(you()).getByRole('button', { name: 'Empty Bench space' }));
    expect(st().players[0].bench.map((p) => p.stack[0])).toContain(a);
    fireEvent.click(handCard(b));
    fireEvent.click(screen.getByRole('button', { name: 'Play Gastly' }));
    expect(st().players[0].bench.map((p) => p.stack[0])).toContain(b);
  });

  test('a Trainer with no target is played with its Play button', () => {
    let ball = '';
    mutate((s) => {
      ball = giveCard(s, 0, 'sv01-181'); // Nest Ball
    });
    render(<GameScreen />);
    fireEvent.click(handCard(ball));
    fireEvent.click(screen.getByRole('button', { name: 'Play Nest Ball' }));
    expect(st().players[0].hand).not.toContain(ball);
  });

  test('tapping your Active opens its actions; an attack can be used from there', () => {
    // Nobody can attack on the first turn of the game.
    if (st().turn === 1) {
      turnOf(1);
      turnOf(0);
    }
    energise();
    render(<GameScreen />);
    const uid = st().players[0].active!.stack.at(-1)!;
    fireEvent.click(activeOf(you(), 0));
    const menu = screen.getByRole('menu', { name: nameOf(uid) });
    const attack = within(menu)
      .getAllByRole('menuitem')
      .find((b) => b.textContent!.includes('Attack'))!;
    expect(attack).toBeEnabled();
    const turn = st().turn;
    fireEvent.click(attack);
    expect(st().turn).toBeGreaterThan(turn); // attacking ends the turn
  });

  test('the action menu has Card details; Close puts it away', () => {
    render(<GameScreen />);
    fireEvent.click(activeOf(you(), 0));
    const menu = screen.getByRole('menu');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Card details' }));
    expect(screen.getByRole('dialog', { name: 'Card details' })).toBeInTheDocument();
  });

  test("tapping the opponent's Active shows its details", () => {
    render(<GameScreen />);
    fireEvent.click(activeOf(opponent(), 1));
    expect(screen.getByRole('dialog', { name: 'Card details' })).toBeInTheDocument();
  });

  test('End turn ends the turn, and it is there only on your turn', () => {
    render(<GameScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }));
    expect(st().current).toBe(1);
    expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull();
  });

  test('Menu holds the log, Concede (asks first) and Quit to home', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    useNav.getState().go('duel');
    render(<GameScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show log' }));
    expect(screen.getByRole('region', { name: 'Game log' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Concede' }));
    expect(confirm).toHaveBeenCalled();
    expect(st().result).toBeNull();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quit to home' }));
    expect(useNav.getState().route).toBe('menu');
  });

  test('the discard count opens your discard pile', () => {
    mutate((s) => {
      s.players[0].discard = s.players[0].deck.splice(0, 2);
    });
    render(<GameScreen />);
    fireEvent.click(within(you()).getByRole('button', { name: 'Discard 2' }));
    expect(screen.getByRole('dialog', { name: 'You discard pile' })).toBeInTheDocument();
  });

  test('while a prompt is open there is no End turn and the prompt is shown', () => {
    useGame.getState().reset();
    useGame.getState().start(botCfg(1));
    render(<GameScreen />);
    expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull();
    expect(screen.getByRole('dialog', { name: st().prompt!.message })).toBeInTheDocument();
  });
});
