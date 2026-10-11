import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { giveCard } from '@ptcg/engine/testing';
import { registry } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { GameScreen } from '../src/screens/GameScreen.tsx';
import { botCfg, finishSetupInStore, mutate, turnOf } from './helpers.ts';

const media = (phone: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('max-width') ? phone : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
const nameOf = (uid: string) => registry.defs[useGame.getState().state!.cards[uid]!.defId]!.name;
const mine = () => screen.getByRole('region', { name: /^You$/ });
const activeCard = () => {
  const s = useGame.getState().state!;
  return mine().querySelector(`[data-uid="${s.players[0].active!.stack[0]}"]`) as HTMLElement;
};

beforeEach(() => {
  localStorage.clear();
  useGame.getState().reset();
  useGame.getState().start(botCfg(1));
  finishSetupInStore();
  turnOf(0);
});
afterEach(() => vi.unstubAllGlobals());

/** Put `n` Energy cards of the Active's type on it so it can attack. */
function energise() {
  mutate((s) => {
    const p = s.players[0];
    const active = p.active!;
    const type = (registry.defs[s.cards[active.stack[0]!]!.defId] as { attacks: { cost: string[] }[] })
      .attacks[0]!.cost[0]!;
    const id = type === 'Psychic' ? 'mee-005' : type === 'Darkness' ? 'mee-007' : 'mee-005';
    for (let i = 0; i < 4; i++) {
      const uid = giveCard(s, 0, id);
      p.hand = p.hand.filter((u) => u !== uid);
      active.energy.push(uid);
    }
  });
}

describe('selecting on a wide screen', () => {
  beforeEach(() => media(false));

  test('your Active is selected when your turn starts, and the panel shows it', () => {
    render(<GameScreen />);
    const s = useGame.getState().state!;
    const name = nameOf(s.players[0].active!.stack[0]!);
    expect(activeCard()).toHaveClass('ring-yellow');
    const panel = screen.getByRole('complementary', { name: 'Selection' });
    expect(within(panel).getByRole('menu', { name })).toBeInTheDocument();
    expect(within(panel).getByText(/Your turn/)).toBeInTheDocument();
  });

  test('clicking a hand card selects it and lists what it can do; clicking it again clears', () => {
    let uid = '';
    mutate((s) => {
      uid = giveCard(s, 0, 'me02-062');
    });
    render(<GameScreen />);
    const card = () =>
      within(screen.getByRole('region', { name: 'Your hand' }))
        .getAllByRole('button')
        .find((b) => b.getAttribute('data-uid') === uid)!;
    fireEvent.click(card());
    expect(card()).toHaveClass('ring-yellow');
    const panel = screen.getByRole('complementary', { name: 'Selection' });
    expect(within(panel).getByRole('menuitem', { name: 'Play Seviper' })).toBeInTheDocument();
    fireEvent.click(card());
    expect(within(panel).getByText('Tap a card to see what it can do.')).toBeInTheDocument();
    expect(activeCard()).not.toHaveClass('ring-yellow');
  });

  test('Escape clears the selection', () => {
    render(<GameScreen />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('Tap a card to see what it can do.')).toBeInTheDocument();
  });

  test('doing something puts the selection back on your Active', () => {
    let uid = '';
    mutate((s) => {
      uid = giveCard(s, 0, 'me02-062');
    });
    render(<GameScreen />);
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Your hand' }))
        .getAllByRole('button')
        .find((b) => b.getAttribute('data-uid') === uid)!,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Play Seviper' }));
    expect(useGame.getState().state!.players[0].bench.map((b) => b.stack[0])).toContain(uid);
    expect(activeCard()).toHaveClass('ring-yellow');
  });

  test('an attack in the panel attacks', () => {
    // the player who goes first cannot attack on their first turn: let both players take one
    turnOf(1);
    turnOf(0);
    energise();
    render(<GameScreen />);
    const before = useGame.getState().actions.length;
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    const usable = items.find(
      (i) => !(i as HTMLButtonElement).disabled && /^Attack:/.test(i.getAttribute('aria-label')!),
    );
    expect(usable).toBeDefined();
    fireEvent.click(usable!);
    expect(useGame.getState().actions.length).toBe(before + 1);
    expect(useGame.getState().actions.at(-1)!.action.type).toBe('attack');
  });

  test("selecting the opponent's Pokémon shows it with nothing to do", () => {
    render(<GameScreen />);
    const s = useGame.getState().state!;
    const oppUid = s.players[1].active!.stack[0]!;
    const opp = screen.getByRole('region', { name: 'Opponent' });
    fireEvent.click(opp.querySelector(`[data-uid="${oppUid}"]`)!);
    const panel = screen.getByRole('complementary', { name: 'Selection' });
    expect(within(panel).getByRole('menu', { name: nameOf(oppUid) })).toBeInTheDocument();
    expect(
      within(panel)
        .queryAllByRole('menuitem')
        .filter((i) => !(i as HTMLButtonElement).disabled),
    ).toEqual([]);
  });

  test('Card details opens the full card and its text', () => {
    render(<GameScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Card details' }));
    expect(screen.getByRole('dialog', { name: 'Card details' })).toBeInTheDocument();
  });

  test('prizes are drawn as a grid of card backs with a count for screen readers', () => {
    render(<GameScreen />);
    const prizes = mine().querySelector('[data-prizes]')!;
    expect(prizes).toHaveAttribute('aria-label', '6 Prizes');
    expect(prizes.querySelectorAll('[data-prize]')).toHaveLength(6);
  });

  test('End turn and the log are in the side column', () => {
    render(<GameScreen />);
    expect(screen.getByRole('button', { name: 'End turn' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Game log' })).toBeInTheDocument();
  });
});
