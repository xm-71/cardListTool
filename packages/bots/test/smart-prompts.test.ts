import { describe, expect, test } from 'vitest';
import {
  createEngine,
  type Action,
  type GameState,
  type PlayerId,
  type PlayerView,
  type Prompt,
  type PromptOption,
} from '@ptcg/engine';
import { attachFromDeck, benchFromHand, finishSetup, giveCard, swapActiveTo } from '@ptcg/engine/testing';
import { buildRegistry, metaDragapultDeck, metaOgerponBoxDeck } from '@ptcg/cards';
import { deckPlan } from '../src/plan.ts';
import { answerPrompt } from '../src/smart.ts';

const registry = buildRegistry();
const engine = createEngine(registry);
const plan = deckPlan(metaDragapultDeck, registry);

const DREEPY = 'sv06-128';
const DRAKLOAK = 'sv06-129';
const DRAGAPULT = 'sv06-130';
const MUNKIDORI = 'sv06-095';
const FEZANDIPITI = 'sv06.5-038';
const BUDEW = 'me02.5-016';
const MEOWTH = 'me03-062';
const RARE_CANDY = 'me01-125';
const FIRE = 'mee-002';
const PSYCHIC = 'mee-005';

/** Player 0 plays Dragapult, player 1 plays the Ogerpon box; player 0's turn, setup done. */
function position(): { s: GameState; me: PlayerId; opp: PlayerId } {
  const s = finishSetup(
    engine,
    engine.createGame({ decks: [metaDragapultDeck, metaOgerponBoxDeck], seed: 3 }),
  );
  return { s, me: 0, opp: 1 };
}

/** Active Dragapult ex holding Fire + Psychic (Phantom Dive ready). */
function readyDragapult(s: GameState, me: PlayerId): void {
  swapActiveTo(s, me, DRAGAPULT);
  attachFromDeck(s, me, FIRE);
  attachFromDeck(s, me, PSYCHIC);
}

let extra = 0;
/** A card that is not in the deck (e.g. Rare Candy), put straight into a hand. */
function addToHand(s: GameState, p: PlayerId, defId: string): string {
  const uid = `extra-${extra++}`;
  s.cards[uid] = { uid, defId, owner: p };
  s.players[p].hand.push(uid);
  return uid;
}

/** Move every card of `defId` out of the hand, back into the deck. */
function stripFromHand(s: GameState, p: PlayerId, defId: string): void {
  const pl = s.players[p];
  const out = pl.hand.filter((u) => s.cards[u]!.defId === defId);
  pl.hand = pl.hand.filter((u) => !out.includes(u));
  pl.deck.push(...out);
}

const uidIn = (s: GameState, zone: 'deck' | 'hand', p: PlayerId, defId: string): string =>
  s.players[p][zone].find((u) => s.cards[u]!.defId === defId)!;

const cardOption = (s: GameState, uid: string): PromptOption => ({
  id: uid,
  label: registry.defs[s.cards[uid]!.defId]!.name,
  uid,
  defId: s.cards[uid]!.defId,
});

function ask(
  s: GameState,
  me: PlayerId,
  prompt: Omit<Prompt, 'player' | 'selected'> & { selected?: string[] },
): Action {
  const full: Prompt = { player: me, selected: [], ...prompt };
  const view: PlayerView = { ...engine.viewFor(s, me), prompt: full };
  const legal: Action[] = [
    ...full.options.map((o): Action => ({ type: 'answer', optionId: o.id })),
    ...(full.selected.length >= full.min ? [{ type: 'answer', optionId: 'done' } as Action] : []),
  ];
  return answerPrompt(view, legal, plan, registry);
}

describe('smart prompt answers', () => {
  test('gust takes the Pokémon it can Knock Out over a bigger one it cannot', () => {
    const { s, me, opp } = position();
    swapActiveTo(s, me, DRAGAPULT);
    attachFromDeck(s, me, FIRE);
    attachFromDeck(s, me, PSYCHIC); // Phantom Dive: 200
    swapActiveTo(s, opp, 'sv06-025');
    benchFromHand(s, opp, giveCard(s, opp, FEZANDIPITI)); // 210 HP: out of reach
    benchFromHand(s, opp, giveCard(s, opp, BUDEW)); // 30 HP: in reach
    const options: PromptOption[] = [
      { id: 'b0', label: 'Fezandipiti ex', slot: { player: opp, zone: 'bench', index: 0 } },
      { id: 'b1', label: 'Budew', slot: { player: opp, zone: 'bench', index: 1 } },
    ];
    const a = ask(s, me, { kind: 'slot', message: 'Choose a Pokémon', options, min: 1, max: 1 });
    expect(a).toEqual({ type: 'answer', optionId: 'b1' });
  });

  test('search takes the missing Stage 1 over a fourth Basic', () => {
    const { s, me } = position();
    swapActiveTo(s, me, DREEPY);
    stripFromHand(s, me, DRAKLOAK);
    stripFromHand(s, me, DRAGAPULT);
    const dreepy = uidIn(s, 'deck', me, DREEPY);
    const drakloak = uidIn(s, 'deck', me, DRAKLOAK);
    const a = ask(s, me, {
      kind: 'cards',
      message: 'Choose a Pokémon',
      options: [cardOption(s, dreepy), cardOption(s, drakloak)],
      min: 1,
      max: 1,
    });
    expect(a).toEqual({ type: 'answer', optionId: drakloak });
  });

  test('discard keeps Rare Candy and the Stage 2 while a line waits', () => {
    const { s, me } = position();
    swapActiveTo(s, me, DREEPY);
    s.players[me].deck.push(...s.players[me].hand);
    s.players[me].hand = [];
    const candy = addToHand(s, me, RARE_CANDY);
    const dragapult = giveCard(s, me, DRAGAPULT);
    const energies = [giveCard(s, me, PSYCHIC), giveCard(s, me, PSYCHIC), giveCard(s, me, FIRE)];
    const hand = [candy, dragapult, ...energies];
    const picks: string[] = [];
    for (let i = 0; i < 2; i++) {
      const a = ask(s, me, {
        kind: 'cards',
        message: 'Discard 2 cards from your hand',
        options: hand.filter((u) => !picks.includes(u)).map((u) => cardOption(s, u)),
        min: 2,
        max: 2,
        selected: [...picks],
      });
      picks.push((a as { optionId: string }).optionId);
    }
    expect(picks).not.toContain(candy);
    expect(picks).not.toContain(dragapult);
  });

  test('switch brings in the Pokémon that can attack', () => {
    const { s, me } = position();
    swapActiveTo(s, me, DREEPY);
    benchFromHand(s, me, giveCard(s, me, MUNKIDORI));
    benchFromHand(s, me, giveCard(s, me, DRAGAPULT));
    s.players[me].bench[1]!.energy.push(giveCardEnergy(s, me, FIRE), giveCardEnergy(s, me, PSYCHIC));
    const options: PromptOption[] = [0, 1].map((i) => ({
      id: `s${i}`,
      label: `bench ${i}`,
      slot: { player: me, zone: 'bench', index: i },
    }));
    const a = ask(s, me, {
      kind: 'slot',
      message: 'Switch in which Benched Pokémon?',
      options,
      min: 1,
      max: 1,
    });
    expect(a).toEqual({ type: 'answer', optionId: 's1' });
  });

  test('stops with done when nothing useful is left', () => {
    const { s, me } = position();
    swapActiveTo(s, me, DREEPY);
    stripFromHand(s, me, DRAKLOAK);
    giveCard(s, me, DRAKLOAK); // one Drakloak is already in hand, so another copy is not needed
    const second = uidIn(s, 'deck', me, DRAKLOAK);
    const a = ask(s, me, {
      kind: 'cards',
      message: 'Choose up to 2 Pokémon',
      options: [cardOption(s, second)],
      min: 0,
      max: 2,
      selected: ['picked-already'],
    });
    expect(a).toEqual({ type: 'answer', optionId: 'done' });
  });

  test('pays Energy from the hand for an attack that deals damage for each card discarded', () => {
    const { s, me } = position();
    swapActiveTo(s, me, DREEPY);
    benchFromHand(s, me, giveCard(s, me, DRAGAPULT)); // short of Energy: Energy would normally be kept
    s.players[me].deck.push(...s.players[me].hand);
    s.players[me].hand = [];
    const energies = [giveCard(s, me, PSYCHIC), giveCard(s, me, FIRE)];
    const picks: string[] = [];
    for (let i = 0; i < 2; i++) {
      const a = ask(s, me, {
        kind: 'cards',
        message: 'Discard up to 2 Basic {W} Energy (140 damage each)',
        options: energies.filter((u) => !picks.includes(u)).map((u) => cardOption(s, u)),
        min: 0,
        max: 2,
        selected: [...picks],
      });
      expect((a as { optionId: string }).optionId).not.toBe('done');
      picks.push((a as { optionId: string }).optionId);
    }
    expect(picks.sort()).toEqual([...energies].sort());
  });

  test('damage counters finish a Knock Out before stacking on a bigger target', () => {
    const { s, me, opp } = position();
    readyDragapult(s, me);
    swapActiveTo(s, opp, 'sv06-025');
    benchFromHand(s, opp, addToHand(s, opp, MEOWTH)); // 170 HP, full: within the attack's reach, worth 2 Prizes
    benchFromHand(s, opp, giveCard(s, opp, BUDEW)); // 30 HP
    s.players[opp].bench[1]!.damage = 20; // 10 HP left: one counter finishes it
    const options: PromptOption[] = [
      { id: 'b0', label: 'Meowth ex', slot: { player: opp, zone: 'bench', index: 0 } },
      { id: 'b1', label: 'Budew', slot: { player: opp, zone: 'bench', index: 1 } },
    ];
    const a = ask(s, me, {
      kind: 'slot',
      message: 'Put a damage counter on a Benched Pokémon (6 left)',
      options,
      min: 1,
      max: 1,
    });
    expect(a).toEqual({ type: 'answer', optionId: 'b1' });
  });

  test('answers a forced choice even when every option is protected', () => {
    const { s, me } = position();
    swapActiveTo(s, me, DREEPY);
    s.players[me].deck.push(...s.players[me].hand);
    s.players[me].hand = [];
    const candy = addToHand(s, me, RARE_CANDY);
    const dragapult = giveCard(s, me, DRAGAPULT);
    const a = ask(s, me, {
      kind: 'cards',
      message: 'Discard a card',
      options: [cardOption(s, candy), cardOption(s, dragapult)],
      min: 1,
      max: 1,
    });
    expect([candy, dragapult]).toContain((a as { optionId: string }).optionId);
  });
});

/** An Energy card taken from the deck, ready to be attached by hand. */
function giveCardEnergy(s: GameState, p: PlayerId, defId: string): string {
  const uid = giveCard(s, p, defId);
  s.players[p].hand.splice(s.players[p].hand.indexOf(uid), 1);
  return uid;
}
