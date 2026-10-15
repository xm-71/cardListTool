import { describe, expect, test } from 'vitest';
import { createEngine, type Action, type DeckList, type GameState, type PlayerId } from '@ptcg/engine';
import { attachFromDeck, benchFromHand, finishSetup, giveCard, swapActiveTo } from '@ptcg/engine/testing';
import * as cards from '@ptcg/cards';
import { createEasyBot } from '../src/easy.ts';
import { runMatch } from '../src/runMatch.ts';
import { createSmartBot } from '../src/smart.ts';

const registry = cards.buildRegistry();
const engine = createEngine(registry);
const dragapult = cards.metaDragapultDeck;
const ogerpon = cards.metaOgerponBoxDeck;
const bot = createSmartBot(registry, [dragapult, ogerpon]);

const DREEPY = 'sv06-128';
const DRAKLOAK = 'sv06-129';
const DRAGAPULT = 'sv06-130';
const MUNKIDORI = 'sv06-095';
const FEZANDIPITI = 'sv06.5-038';
const BUDEW = 'me02.5-016';
const KANGASKHAN = 'me01-104';
const POFFIN = 'me01-167';
const LILLIE = 'me01-119';
const BOSS = 'me01-114';
const FIRE = 'mee-002';
const PSYCHIC = 'mee-005';

/** Player 0's third turn (so Supporters and attacks are allowed), Dragapult vs the Ogerpon box. */
function turn(): { s: GameState; me: PlayerId; opp: PlayerId } {
  // Player 0 plays Dragapult; use a seed where they also go first, so two End Turns bring it back to them.
  for (let seed = 9; ; seed++) {
    let s = finishSetup(engine, engine.createGame({ decks: [dragapult, ogerpon], seed }));
    if (s.first !== 0) continue;
    for (let i = 0; i < 2; i++) s = engine.applyAction(s, s.current, { type: 'endTurn' }).state;
    return { s, me: 0, opp: 1 };
  }
}

/** Replace the hand with exactly these cards (taken from the deck). */
function setHand(s: GameState, p: PlayerId, defIds: string[]): string[] {
  const pl = s.players[p];
  pl.deck.push(...pl.hand);
  pl.hand = [];
  return defIds.map((d) => giveCard(s, p, d));
}

let extra = 0;
function addToHand(s: GameState, p: PlayerId, defId: string): string {
  const uid = `extra-${extra++}`;
  s.cards[uid] = { uid, defId, owner: p };
  s.players[p].hand.push(uid);
  return uid;
}

function decide(s: GameState, me: PlayerId): Action {
  const legal = engine.getLegalActions(s, me);
  return bot(engine.viewFor(s, me), legal, 5).action;
}

/** Active Dragapult ex holding Fire + Psychic (Phantom Dive ready). */
function readyDragapult(s: GameState, me: PlayerId): void {
  swapActiveTo(s, me, DRAGAPULT);
  attachFromDeck(s, me, FIRE);
  attachFromDeck(s, me, PSYCHIC);
}

describe('smart turn policy', () => {
  test('plays a search Item before a draw Supporter', () => {
    const { s, me } = turn();
    swapActiveTo(s, me, DREEPY);
    const [poffin] = setHand(s, me, [POFFIN, LILLIE, FIRE, FIRE, FIRE]);
    expect(decide(s, me)).toEqual({ type: 'playTrainer', uid: poffin });
  });

  test('does not play a draw Supporter into a hand that still has plays', () => {
    const { s, me } = turn();
    swapActiveTo(s, me, DREEPY);
    setHand(s, me, [LILLIE, FIRE, FIRE, PSYCHIC, PSYCHIC, FIRE]);
    expect(decide(s, me).type).toBe('attachEnergy');
  });

  test("plays Boss's Orders when it leads to a Knock Out the Active cannot match", () => {
    const { s, me, opp } = turn();
    readyDragapult(s, me);
    swapActiveTo(s, opp, KANGASKHAN); // 300 HP: out of reach
    benchFromHand(s, opp, giveCard(s, opp, BUDEW)); // 30 HP: in reach
    const [boss] = setHand(s, me, [BOSS]);
    expect(decide(s, me)).toEqual({ type: 'playTrainer', uid: boss });
  });

  test("does not play Boss's Orders when the Active is already the best Knock Out", () => {
    const { s, me, opp } = turn();
    readyDragapult(s, me);
    swapActiveTo(s, opp, BUDEW);
    benchFromHand(s, opp, giveCard(s, opp, FEZANDIPITI)); // 210 HP: out of reach
    setHand(s, me, [BOSS]);
    expect(decide(s, me).type).toBe('attack');
  });

  test('retreats when the Active cannot attack and a Benched Pokémon can', () => {
    const { s, me } = turn();
    swapActiveTo(s, me, DREEPY);
    attachFromDeck(s, me, FIRE); // pays the retreat, does not let Dreepy attack
    benchFromHand(s, me, giveCard(s, me, DRAGAPULT));
    attachFromDeck(s, me, FIRE, 0);
    attachFromDeck(s, me, PSYCHIC, 0);
    setHand(s, me, []);
    expect(decide(s, me)).toEqual({ type: 'retreat', benchIndex: 0 });
  });

  test('attaches Energy to the planned attacker, not the support Pokémon in front', () => {
    const { s, me } = turn();
    swapActiveTo(s, me, MUNKIDORI);
    benchFromHand(s, me, giveCard(s, me, DRAGAPULT));
    attachFromDeck(s, me, FIRE, 0);
    setHand(s, me, [PSYCHIC]);
    const a = decide(s, me);
    expect(a.type).toBe('attachEnergy');
    expect((a as { target: unknown }).target).toEqual({ player: me, zone: 'bench', index: 0 });
  });

  test('does not Bench an extra ex the plan does not need', () => {
    const { s, me } = turn();
    swapActiveTo(s, me, DREEPY);
    benchFromHand(s, me, giveCard(s, me, DREEPY));
    setHand(s, me, []);
    addToHand(s, me, 'sv06-025'); // Teal Mask Ogerpon ex: not in this deck's plan
    expect(decide(s, me).type).not.toBe('playBasic');
  });

  const PREMADE: DeckList[] = [
    cards.megaGengarDeck,
    cards.megaDiancieDeck,
    cards.megaLucarioDeck,
    cards.megaCharizardXDeck,
    cards.megaVenusaurDeck,
    cards.megaAbomasnowDeck,
    cards.megaManectricDeck,
    cards.megaKangaskhanDeck,
    cards.megaLopunnyDeck,
    cards.metaDragapultDeck,
    cards.metaAlakazamDeck,
    cards.metaOgerponBoxDeck,
    cards.metaNsZoroarkDeck,
    cards.metaSlowkingDeck,
    cards.metaCrustleDeck,
  ];
  test.each(PREMADE.map((d, i) => [d.name, i] as const))('smart vs easy plays %s to the end', (_name, i) => {
    const easy = createEasyBot(registry);
    const other = PREMADE[(i + 5) % PREMADE.length]!;
    const decks: [DeckList, DeckList] = i % 2 === 0 ? [PREMADE[i]!, other] : [other, PREMADE[i]!];
    const smart = createSmartBot(registry, decks);
    const seat = i % 2 === 0 ? 0 : 1;
    const bots = seat === 0 ? [smart, easy] : [easy, smart];
    const r = runMatch({ engine, decks, seed: 100 + i, bots: bots as [typeof smart, typeof smart] });
    expect(r.violations).toEqual([]);
    expect(r.result).not.toBeNull();
  });
});
