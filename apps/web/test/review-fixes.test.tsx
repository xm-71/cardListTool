import { act as rtlAct, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { benchFromHand, giveCard, swapActiveTo } from '@ptcg/engine/testing';
import type { Prompt } from '@ptcg/engine';
import { App, nextSeed } from '../src/App.tsx';
import { describeAction } from '../src/game/actions.ts';
import type { BotClient } from '../src/game/botClient.ts';
import { engine, registry } from '../src/game/catalog.ts';
import { actorOf, useGame } from '../src/game/store.ts';
import { PromptPanel } from '../src/ui/PromptPanel.tsx';
import { botCfg, finishSetupInStore, mutate, seedWhereSeat0PromptsFirst, turnOf } from './helpers.ts';

beforeEach(() => useGame.getState().reset());
afterEach(() => vi.useRealTimers());

const nameOf = (uid: string) => registry.defs[useGame.getState().state!.cards[uid]!.defId]!.name;

describe('hotseat selection', () => {
  test('a card picked by one player is not shown to the next player after passing', () => {
    useGame.getState().start({ ...botCfg(seedWhereSeat0PromptsFirst()), mode: 'hotseat' });
    finishSetupInStore();
    render(<App botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
    const s = useGame.getState().state!;
    const me = actorOf(s)!;
    const picked = s.players[me].hand[0]!;
    fireEvent.click(within(screen.getByRole('region', { name: 'Your hand' })).getAllByRole('button')[0]!);
    const panel = () => screen.getByRole('complementary', { name: 'Selection' });
    expect(within(panel()).getByRole('menu', { name: nameOf(picked) })).toBeInTheDocument();
    rtlAct(() => useGame.getState().dispatch(me, { type: 'endTurn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
    expect(document.querySelector(`[data-uid="${picked}"]`)).toBeNull();
    expect(within(panel()).queryByRole('menu', { name: nameOf(picked) })).toBeNull();
  });
});

describe('bot failures', () => {
  test('a bot that throws shows the error screen instead of stalling', async () => {
    const broken: BotClient = { choose: () => Promise.reject(new Error('bot exploded')) };
    useGame.getState().start(botCfg(1));
    render(<App botClient={broken} botDelayMs={0} />);
    // let the human finish setup so the bot must act at some point
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
        }
        if (actorOf(useGame.getState().state!) === 0 && useGame.getState().state!.phase === 'main') {
          rtlAct(() => useGame.getState().dispatch(0, { type: 'endTurn' }));
        }
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(screen.getByText(/bot exploded/)).toBeInTheDocument();
  });

  test('the game screen always offers a way back home', () => {
    useGame.getState().start(botCfg(1));
    finishSetupInStore();
    render(<App botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Quit to home' }));
    expect(useGame.getState().state).toBeNull();
  });
});

describe('same-name targets', () => {
  test('labels say which Pokémon when two share a name', () => {
    useGame.getState().start(botCfg(1));
    finishSetupInStore();
    turnOf(0);
    let energy = '';
    mutate((s) => {
      swapActiveTo(s, 0, 'me02-054');
      benchFromHand(s, 0, giveCard(s, 0, 'me02-054'));
      benchFromHand(s, 0, giveCard(s, 0, 'me02-054'));
      energy = giveCard(s, 0, 'mee-007');
    });
    const s = useGame.getState().state!;
    const view = engine.viewFor(s, 0);
    const label = (zone: 'active' | number) =>
      describeAction(
        {
          type: 'attachEnergy',
          uid: energy,
          target: zone === 'active' ? { player: 0, zone } : { player: 0, zone: 'bench', index: zone },
        },
        view,
      );
    expect(label('active')).toBe('Attach Darkness Energy to Gastly (Active)');
    expect(label(1)).toBe('Attach Darkness Energy to Gastly (Bench 2)');
    expect(describeAction({ type: 'retreat', benchIndex: 0 }, view)).toBe('Retreat to Gastly (Bench 1)');
  });

  test('slot options in a prompt show each Pokémon’s HP', () => {
    useGame.getState().start(botCfg(1));
    finishSetupInStore();
    const s = useGame.getState().state!;
    const view = engine.viewFor(s, 0);
    const prompt: Prompt = {
      player: 0,
      kind: 'slot',
      message: 'Choose a new Active Pokémon',
      options: [{ id: 'p0-active', label: 'x', slot: { player: 0, zone: 'active' } }],
      min: 1,
      max: 1,
      selected: [],
    };
    render(<PromptPanel prompt={prompt} view={{ ...view, prompt }} legal={[]} onAnswer={() => {}} />);
    const hp = registry.defs[s.cards[s.players[0].active!.stack[0]!]!.defId]! as { hp: number };
    expect(screen.getByText(`${hp.hp - s.players[0].active!.damage}/${hp.hp}`)).toBeInTheDocument();
  });
});

describe('reading cards', () => {
  test("clicking the opponent's Pokémon shows it in the side panel, and Card details opens it", () => {
    useGame.getState().start(botCfg(1));
    finishSetupInStore();
    render(<App botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
    const opp = screen.getByRole('region', { name: 'Opponent' });
    fireEvent.click(within(opp).getAllByRole('button')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Card details' }));
    expect(screen.getByRole('dialog', { name: 'Card details' })).toBeInTheDocument();
  });
});

describe('double clicks on prompts', () => {
  test('a click right after a prompt appears is ignored', () => {
    vi.useFakeTimers();
    useGame.getState().start(botCfg(1));
    const s = useGame.getState().state!;
    const view = engine.viewFor(s, s.prompt!.player);
    const onAnswer = vi.fn();
    render(
      <PromptPanel
        prompt={s.prompt!}
        view={view}
        legal={engine.getLegalActions(s, s.prompt!.player)}
        onAnswer={onAnswer}
      />,
    );
    const firstCard = screen.getAllByRole('button')[0]!;
    fireEvent.click(firstCard);
    expect(onAnswer).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    fireEvent.click(firstCard);
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
});

describe('Play again seeds', () => {
  test('successive seeds stay distinct 32-bit values', () => {
    const seen = new Set<number>();
    let seed = 123456789;
    for (let i = 0; i < 1000; i++) {
      seed = nextSeed(seed);
      expect(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32).toBe(true);
      seen.add(seed);
    }
    expect(seen.size).toBe(1000);
  });
});
