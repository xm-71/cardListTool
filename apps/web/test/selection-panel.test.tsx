import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Action, PlayerView } from '@ptcg/engine';
import { engine } from '../src/game/catalog.ts';
import { useGame } from '../src/game/store.ts';
import { panelModel } from '../src/game/selection.ts';
import { defOf, topDef } from '../src/game/view.ts';
import { SelectionPanel } from '../src/ui/SelectionPanel.tsx';
import { botCfg, finishSetupInStore, turnOf } from './helpers.ts';

let view: PlayerView;
beforeEach(() => {
  useGame.getState().reset();
  useGame.getState().start(botCfg(1));
  finishSetupInStore();
  turnOf(0);
  view = engine.viewFor(useGame.getState().state!, 0);
});
const active = { kind: 'slot', ref: { player: 0, zone: 'active' } } as const;

function setup(legal: Action[], over: Partial<Parameters<typeof SelectionPanel>[0]> = {}) {
  const props = {
    view,
    status: 'Turn 1 · Your turn',
    model: panelModel(view, legal, active, 0),
    onAct: vi.fn(),
    onDetails: vi.fn(),
    ...over,
  };
  render(<SelectionPanel {...props} />);
  return props;
}

describe('SelectionPanel', () => {
  test('shows the turn status', () => {
    setup([]);
    expect(screen.getByText('Turn 1 · Your turn')).toBeInTheDocument();
  });

  test('with nothing selected it says what to do', () => {
    setup([], { model: null });
    expect(screen.getByText('Tap a card to see what it can do.')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('shows the selected Pokémon and a menu named after it', () => {
    setup([]);
    const name = defOf(view.you.active!.stack[0]!).name;
    expect(screen.getByRole('menu', { name })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name })[0]).toBeInTheDocument();
  });

  test('lists every attack, enabled ones act and the rest are disabled', () => {
    const attacks = topDef(view.you.active!).attacks;
    const legal: Action[] = [{ type: 'attack', attackIndex: 0 }];
    const p = setup(legal);
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    const attackItems = items.slice(0, attacks.length);
    expect(attackItems).toHaveLength(attacks.length);
    expect(attackItems[0]).toBeEnabled();
    fireEvent.click(attackItems[0]!);
    expect(p.onAct).toHaveBeenCalledWith({ type: 'attack', attackIndex: 0 });
    attackItems.slice(1).forEach((item) => expect(item).toBeDisabled());
  });

  test('an attack item is named like the action label and shows its cost and damage', () => {
    const atk = topDef(view.you.active!).attacks[0]!;
    setup([{ type: 'attack', attackIndex: 0 }]);
    const label =
      atk.damage > 0 ? `Attack: ${atk.name} (${atk.damage}${atk.damageSuffix})` : `Attack: ${atk.name}`;
    const item = screen.getByRole('menuitem', { name: label });
    expect(item).toHaveTextContent(atk.name);
    if (atk.damage > 0) expect(item).toHaveTextContent(String(atk.damage));
    expect(within(item).queryAllByTestId('energy-dot').length).toBe(atk.cost.length);
  });

  test('other actions come after the attacks and act when clicked', () => {
    const attach: Action = { type: 'attachEnergy', uid: 'x', target: { player: 0, zone: 'active' } };
    const p = setup([attach]);
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    fireEvent.click(items[items.length - 1]!);
    expect(p.onAct).toHaveBeenCalledWith(attach);
  });

  test('Card details opens the card', () => {
    const p = setup([]);
    fireEvent.click(screen.getByRole('button', { name: 'Card details' }));
    expect(p.onDetails).toHaveBeenCalledWith(view.you.active!.stack[0]);
  });

  test('a Stadium effect that can be used is a menu item', () => {
    const use: Action = { type: 'useStadium' } as Action;
    const p = setup([], { stadium: { card: view.you.hand[0]!, action: use } });
    fireEvent.click(screen.getByRole('menuitem', { name: /^Use / }));
    expect(p.onAct).toHaveBeenCalledWith(use);
  });
});
