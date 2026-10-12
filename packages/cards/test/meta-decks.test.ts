import { describe, expect, test } from 'vitest';
import type { Action, CardDef, DeckList, GameState, PlayerId, SlotRef } from '@ptcg/engine';
import { maxHp, standard2026 } from '@ptcg/engine';
import { isPlayable } from '../src/playable.ts';
import alakazamDeck from '../src/decks/meta-alakazam.json';
import crustleDeck from '../src/decks/meta-crustle.json';
import dragapultDeck from '../src/decks/meta-dragapult.json';
import zoroarkDeck from '../src/decks/meta-ns-zoroark.json';
import ogerponDeck from '../src/decks/meta-ogerpon-box.json';
import slowkingDeck from '../src/decks/meta-slowking.json';
import {
  act,
  answer,
  attachFromDeck,
  benchFromHand,
  engine,
  game as startGame,
  giveCard,
  inHand,
  registry,
  resolvePrompts,
  swapActiveTo,
} from './helpers.ts';

const M = {
  dreepy: 'sv06-128',
  drakloak: 'sv06-129',
  dragapult: 'sv06-130',
  munkidori: 'sv06-095',
  budew: 'me02.5-016',
  dunsparce: 'sv05-128',
  dudunsparce: 'sv05-129',
  meowth: 'me03-062',
  crispin: 'sv07-133',
  pokePad: 'me03-081',
  unfairStamp: 'sv06-165',
  abra: 'me01-054',
  kadabra: 'me01-055',
  alakazam: 'me01-056',
  dawn: 'me02-087',
  telepathic: 'me03-088',
  enriching: 'sv08-191',
  luckyHelmet: 'sv06-158',
  battleCage: 'me02-085',
  ogerpon: 'sv06-025',
  latias: 'sv08-076',
  clefairy: 'sv09-056',
  primeCatcher: 'sv05-157',
  zorua: 'sv09-097',
  zoroark: 'sv09-098',
  reshiram: 'sv09-116',
  zekrom: 'me02.5-155',
  pecharunt: 'sv06.5-039',
  slowpoke: 'sv07-057',
  slowking: 'sv07-058',
  kyurem: 'sv06.5-047',
  ciphermaniac: 'sv05-145',
  dwebble: 'sv10-011',
  crustle: 'sv10-012',
  xerosic: 'sv06.5-064',
  redCard: 'me04-082',
  growingGrass: 'me03-086',
  spiky: 'sv09-159',
  lillie: 'me01-119',
  ultraBall: 'me01-131',
  megaKangaskhan: 'me01-104',
  grass: 'mee-001',
  fire: 'mee-002',
  lightning: 'mee-004',
  psychic: 'mee-005',
  darkness: 'mee-007',
} as const;

const active = (p: PlayerId): SlotRef => ({ player: p, zone: 'active' });
/** A started game: `spec0` is the acting player's deck. Both decks hold a Basic Pokémon (setup needs one). */
const game = (
  spec0: Record<string, number>,
  spec1: Record<string, number> = { [M.dreepy]: 4 },
  opts?: Parameters<typeof startGame>[2],
) => {
  const mine = { [M.dreepy]: 4, ...spec0 };
  const theirs = { [M.dreepy]: 4, ...spec1 };
  // The second player acts on turn 2, the first on turn 3.
  return opts?.turn === 3 ? startGame(mine, theirs, opts) : startGame(theirs, mine, opts);
};
const ability = (p: PlayerId, name: string, zone: 'active' | number = 'active'): Action => ({
  type: 'useAbility',
  slot: zone === 'active' ? active(p) : { player: p, zone: 'bench', index: zone },
  ability: name,
});
const attack = (s: GameState, i = 0) => act(engine, s, { type: 'attack', attackIndex: i });
/** Answer the open prompt with the option for a card of `defId` (a prompt the engine settled itself is skipped). */
const pickCard = (s: GameState, defId: string) => {
  const o = s.prompt?.options.find((o) => o.uid && s.cards[o.uid]!.defId === defId);
  return o ? answer(s, o.id) : s;
};
const pickSlot = (s: GameState, ref: SlotRef) => {
  const o = s.prompt?.options.find(
    (o) =>
      o.slot &&
      o.slot.player === ref.player &&
      o.slot.zone === ref.zone &&
      (ref.zone === 'active' || (o.slot as { index: number }).index === ref.index),
  );
  return o ? answer(s, o.id) : s;
};

describe('the meta decks', () => {
  test.each([
    ['Dragapult ex', dragapultDeck],
    ['Alakazam', alakazamDeck],
    ['Ogerpon Box', ogerponDeck],
    ["N's Zoroark ex", zoroarkDeck],
    ['Slowking', slowkingDeck],
    ['Crustle', crustleDeck],
  ] as [string, DeckList][])(
    '%s has 60 playable cards, 4 copies at most, and 1 ACE SPEC at most',
    (_n, deck) => {
      expect(deck.cards.reduce((n, c) => n + c.count, 0)).toBe(60);
      let aceSpecs = 0;
      for (const c of deck.cards) {
        const def = registry.defs[c.id] as CardDef;
        expect(def, c.id).toBeDefined();
        expect(isPlayable(def, registry), `${c.id} ${def.name}`).toBe(true);
        if (!(def.category === 'Energy' && def.energyKind === 'Basic'))
          expect(c.count, def.name).toBeLessThanOrEqual(4);
        if (def.category === 'Trainer' && def.isAceSpec) aceSpecs += c.count;
      }
      expect(aceSpecs).toBeLessThanOrEqual(1);
    },
  );
});

describe('Dragapult ex deck', () => {
  test('Drakloak puts 1 of the top 2 cards into your hand and the other on the bottom', () => {
    const { s: s0, me } = game({ [M.drakloak]: 2 });
    swapActiveTo(s0, me, M.drakloak);
    const top = s0.players[me].deck.slice(0, 2);
    let s = act(engine, s0, ability(me, 'Recon Directive'));
    s = answer(s, s.prompt!.options.find((o) => o.uid === top[1])!.id);
    expect(s.players[me].hand).toContain(top[1]);
    expect(s.players[me].deck.at(-1)).toBe(top[0]);
  });

  test('Phantom Dive does 200 and puts 6 damage counters on the Bench, unless Battle Cage is in play', () => {
    const run = (cage: boolean) => {
      const {
        s: s0,
        me,
        opp,
      } = game(
        { [M.dragapult]: 2, [M.fire]: 4, [M.psychic]: 4, [M.battleCage]: 2 },
        { [M.megaKangaskhan]: 4 },
      );
      swapActiveTo(s0, me, M.dragapult);
      attachFromDeck(s0, me, M.fire);
      attachFromDeck(s0, me, M.psychic);
      swapActiveTo(s0, opp, M.megaKangaskhan);
      benchFromHand(s0, opp, giveCard(s0, opp, M.megaKangaskhan));
      let s = s0;
      if (cage) s = act(engine, s, { type: 'playTrainer', uid: inHand(s, me, M.battleCage) });
      s = resolvePrompts(attack(s, 1));
      return { active: s.players[opp].active!.damage, bench: s.players[opp].bench[0]!.damage };
    };
    expect(run(false)).toEqual({ active: 200, bench: 60 });
    expect(run(true)).toEqual({ active: 200, bench: 0 });
  });

  test("Munkidori moves up to 3 damage counters to the opponent's Pokémon", () => {
    const { s: s0, me, opp } = game({ [M.munkidori]: 2, [M.darkness]: 4 });
    swapActiveTo(s0, me, M.munkidori);
    attachFromDeck(s0, me, M.darkness);
    s0.players[me].active!.damage = 50;
    let s = act(engine, s0, ability(me, 'Adrena-Brain'));
    s = pickSlot(s, active(me));
    s = pickSlot(s, active(opp));
    s = answer(s, '3');
    expect(s.players[me].active!.damage).toBe(20);
    expect(s.players[opp].active!.damage).toBe(30);
  });

  test("Budew's Itchy Pollen stops the opponent playing Items next turn", () => {
    const { s: s0, me, opp } = game({ [M.budew]: 2 }, { [M.ultraBall]: 4 });
    swapActiveTo(s0, me, M.budew);
    giveCard(s0, opp, M.ultraBall);
    const s = attack(s0);
    expect(s.current).toBe(opp);
    const items = engine
      .getLegalActions(s, opp)
      .filter((a) => a.type === 'playTrainer' && s.cards[a.uid]!.defId === M.ultraBall);
    expect(items).toEqual([]);
  });

  test('Dudunsparce draws 3 and goes back into the deck with its cards', () => {
    const { s: s0, me } = game({ [M.dudunsparce]: 2 });
    const uid = giveCard(s0, me, M.dudunsparce);
    benchFromHand(s0, me, uid);
    const hand = s0.players[me].hand.length;
    const s = act(engine, s0, ability(me, 'Run Away Draw', 0));
    expect(s.players[me].hand).toHaveLength(hand + 3);
    expect(s.players[me].bench).toHaveLength(0);
    expect(s.players[me].deck).toContain(uid);
  });

  test('Meowth ex finds a Supporter when played to the Bench, and Tuck Tail returns it to the hand', () => {
    const { s: s0, me } = game({ [M.meowth]: 4, [M.lillie]: 4 });
    let s = act(engine, s0, { type: 'playBasic', uid: inHand(s0, me, M.meowth) });
    s = answer(s, 'yes');
    s = pickCard(s, M.lillie);
    expect(s.players[me].hand.some((u) => s.cards[u]!.defId === M.lillie)).toBe(true);
    const { s: t0, me: m } = game({ [M.meowth]: 4 });
    swapActiveTo(t0, m, M.meowth);
    for (let i = 0; i < 3; i++) attachFromDeck(t0, m, M.darkness);
    benchFromHand(t0, m, inHand(t0, m, M.meowth));
    const tucked = resolvePrompts(attack(t0));
    expect(
      tucked.players[m].hand.filter((u) => tucked.cards[u]!.defId === M.meowth).length,
    ).toBeGreaterThanOrEqual(1);
  });

  test("Tuck Tail into a Punk Helmet doesn't break the game: the attacker is already back in the hand", () => {
    // Punk Helmet works for Darkness Pokémon: N's Zoroark ex holds it.
    const { s: s0, me, opp } = game({ [M.meowth]: 4 }, { [M.zoroark]: 2, 'me02-092': 2 });
    swapActiveTo(s0, me, M.meowth);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, M.darkness);
    benchFromHand(s0, me, inHand(s0, me, M.meowth));
    swapActiveTo(s0, opp, M.zoroark);
    const helmet = inHand(s0, opp, 'me02-092');
    s0.players[opp].hand = s0.players[opp].hand.filter((u) => u !== helmet);
    s0.players[opp].active!.tool = helmet;
    expect(() => resolvePrompts(attack(s0))).not.toThrow();
  });

  test('Crispin puts 1 Basic Energy into your hand and attaches another type', () => {
    const { s: s0, me } = game({ [M.crispin]: 2, [M.fire]: 4, [M.psychic]: 4 });
    let s = act(engine, s0, { type: 'playTrainer', uid: inHand(s0, me, M.crispin) });
    s = pickCard(s, M.fire);
    s = pickCard(s, M.psychic);
    s = pickCard(s, M.fire);
    s = pickSlot(s, active(me));
    const attached = s.players[me].active!.energy.map((u) => s.cards[u]!.defId);
    expect(attached).toContain(M.psychic);
  });

  test('Poké Pad only finds Pokémon without a Rule Box', () => {
    const { s: s0, me } = game({ [M.pokePad]: 2, [M.dudunsparce]: 2, [M.dragapult]: 2 });
    const s = act(engine, s0, { type: 'playTrainer', uid: inHand(s0, me, M.pokePad) });
    const offered = s.prompt!.options.filter((o) => o.uid).map((o) => s.cards[o.uid!]!.defId);
    expect(offered).toContain(M.dudunsparce);
    expect(offered).not.toContain(M.dragapult);
  });

  test('Unfair Stamp needs a Knock Out last turn; then you draw 5 and your opponent 2', () => {
    const { s: s0, me, opp } = game({ [M.unfairStamp]: 1 });
    const uid = inHand(s0, me, M.unfairStamp);
    expect(engine.getLegalActions(s0, me).some((a) => a.type === 'playTrainer' && a.uid === uid)).toBe(false);
    s0.players[me].lastKnockedOutTurn = s0.turn - 1;
    const s = act(engine, s0, { type: 'playTrainer', uid });
    expect(s.players[me].hand).toHaveLength(5);
    expect(s.players[opp].hand).toHaveLength(2);
  });
});

describe('Alakazam deck', () => {
  test("Alakazam's Powerful Hand puts 2 damage counters on the Active for each card in hand", () => {
    const { s: s0, me, opp } = game({ [M.alakazam]: 1, [M.psychic]: 4 }, { [M.megaKangaskhan]: 4 });
    swapActiveTo(s0, me, M.alakazam);
    attachFromDeck(s0, me, M.psychic);
    swapActiveTo(s0, opp, M.megaKangaskhan);
    const hand = s0.players[me].hand.length;
    const s = attack(s0);
    expect(s.players[opp].active!.damage).toBe(20 * hand);
  });

  test('Kadabra draws 2 when it evolves from the hand', () => {
    const { s: s0, me } = game({ [M.abra]: 4, [M.kadabra]: 2 }, {}, { turn: 3 });
    swapActiveTo(s0, me, M.abra);
    s0.players[me].active!.enteredTurn = 0;
    const uid = inHand(s0, me, M.kadabra);
    const hand = s0.players[me].hand.length;
    let s = act(engine, s0, { type: 'evolve', uid, target: active(me) });
    if (s.prompt) s = answer(s, s.prompt.options[0]!.id);
    expect(s.players[me].hand).toHaveLength(hand - 1 + 2);
  });

  test('Dawn finds a Basic, a Stage 1 and a Stage 2', () => {
    const { s: s0, me } = game({ [M.dawn]: 2, [M.abra]: 2, [M.kadabra]: 2, [M.alakazam]: 2 });
    let s = act(engine, s0, { type: 'playTrainer', uid: inHand(s0, me, M.dawn) });
    s = pickCard(s, M.abra);
    s = pickCard(s, M.kadabra);
    s = pickCard(s, M.alakazam);
    const ids = s.players[me].hand.map((u) => s.cards[u]!.defId);
    expect(ids).toEqual(expect.arrayContaining([M.abra, M.kadabra, M.alakazam]));
  });

  test('Telepathic Psychic Energy benches 2 Basic Psychic Pokémon when attached to a Psychic Pokémon', () => {
    const { s: s0, me } = game({ [M.abra]: 4, [M.telepathic]: 2 });
    swapActiveTo(s0, me, M.abra);
    let s = act(engine, s0, { type: 'attachEnergy', uid: inHand(s0, me, M.telepathic), target: active(me) });
    s = pickCard(s, M.abra);
    s = pickCard(s, M.abra);
    expect(s.players[me].bench).toHaveLength(2);
  });

  test('Enriching Energy draws 4 when attached', () => {
    const { s: s0, me } = game({ [M.enriching]: 1 });
    const uid = inHand(s0, me, M.enriching);
    const hand = s0.players[me].hand.length;
    const s = act(engine, s0, { type: 'attachEnergy', uid, target: active(me) });
    expect(s.players[me].hand).toHaveLength(hand - 1 + 4);
  });

  test('Lucky Helmet draws 2 when its Active Pokémon is damaged', () => {
    const { s: s0, me, opp } = game({ [M.dudunsparce]: 2 }, { [M.megaKangaskhan]: 2, [M.luckyHelmet]: 2 });
    swapActiveTo(s0, me, M.dudunsparce);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, M.darkness);
    swapActiveTo(s0, opp, M.megaKangaskhan);
    const helmet = inHand(s0, opp, M.luckyHelmet);
    s0.players[opp].hand = s0.players[opp].hand.filter((u) => u !== helmet);
    s0.players[opp].active!.tool = helmet;
    const hand = s0.players[opp].hand.length;
    const s = attack(s0);
    // Their turn starts with a draw too.
    expect(s.players[opp].hand.length).toBe(hand + 2 + 1);
  });
});

describe('Ogerpon Box deck', () => {
  test('Teal Mask Ogerpon ex attaches a Grass Energy from the hand and draws', () => {
    const { s: s0, me } = game({ [M.ogerpon]: 2, [M.grass]: 8 });
    swapActiveTo(s0, me, M.ogerpon);
    inHand(s0, me, M.grass);
    const hand = s0.players[me].hand.length;
    let s = act(engine, s0, ability(me, 'Teal Dance'));
    if (s.prompt) s = pickCard(s, M.grass);
    expect(s.players[me].active!.energy).toHaveLength(1);
    expect(s.players[me].hand).toHaveLength(hand);
  });

  test('Latias ex gives your Basic Pokémon no Retreat Cost', () => {
    const { s: s0, me } = game({ [M.latias]: 2, [M.megaKangaskhan]: 2 });
    swapActiveTo(s0, me, M.megaKangaskhan);
    benchFromHand(s0, me, giveCard(s0, me, M.latias));
    expect(engine.getLegalActions(s0, me)).toContainEqual({ type: 'retreat', benchIndex: 0 });
  });

  test("Lillie's Clefairy ex makes Dragon Pokémon weak to Psychic", () => {
    const { s: s0, me, opp } = game({ [M.clefairy]: 4, [M.psychic]: 8 }, { [M.zekrom]: 4 });
    swapActiveTo(s0, me, M.clefairy);
    attachFromDeck(s0, me, M.psychic);
    attachFromDeck(s0, me, M.psychic);
    swapActiveTo(s0, opp, M.zekrom);
    s0.players[me].bench = [];
    s0.players[opp].bench = [];
    // Full Moon Rondo does 20 with empty Benches; doubled by the Psychic Weakness Fairy Zone gives Zekrom.
    expect(attack(s0).players[opp].active!.damage).toBe(40);
  });
});

describe("N's Zoroark ex and Slowking decks", () => {
  test("Night Joker uses a Benched N's Pokémon's attack", () => {
    const { s: s0, me, opp } = game({ [M.zoroark]: 2, [M.reshiram]: 1 }, { [M.megaKangaskhan]: 2 });
    swapActiveTo(s0, me, M.zoroark);
    attachFromDeck(s0, me, M.darkness);
    attachFromDeck(s0, me, M.darkness);
    benchFromHand(s0, me, giveCard(s0, me, M.reshiram));
    swapActiveTo(s0, opp, M.megaKangaskhan);
    let s = attack(s0);
    s = answer(s, `${M.reshiram}|1`);
    expect(s.players[opp].active!.damage).toBe(170);
  });

  test("Night Joker doesn't offer another N's Zoroark ex's Night Joker", () => {
    const { s: s0, me, opp } = game({ [M.zoroark]: 4, [M.reshiram]: 1 }, { [M.megaKangaskhan]: 2 });
    swapActiveTo(s0, me, M.zoroark);
    attachFromDeck(s0, me, M.darkness);
    attachFromDeck(s0, me, M.darkness);
    benchFromHand(s0, me, inHand(s0, me, M.zoroark));
    benchFromHand(s0, me, giveCard(s0, me, M.reshiram));
    swapActiveTo(s0, opp, M.megaKangaskhan);
    const s = attack(s0);
    expect(s.prompt!.options.map((o) => o.id).every((id) => id.startsWith(M.reshiram))).toBe(true);
  });

  test('Pecharunt ex switches in a Benched Darkness Pokémon and Poisons it', () => {
    const { s: s0, me } = game({ [M.pecharunt]: 1, [M.zorua]: 2 });
    swapActiveTo(s0, me, M.pecharunt);
    benchFromHand(s0, me, giveCard(s0, me, M.zorua));
    let s = act(engine, s0, ability(me, 'Subjugating Chains'));
    if (s.prompt) s = resolvePrompts(s);
    expect(s.cards[s.players[me].active!.stack[0]!]!.defId).toBe(M.zorua);
    expect(s.players[me].active!.conditions.poisoned).toBe(true);
  });

  test("Slowking's Seek Inspiration uses the attack of a Pokémon it discards", () => {
    const {
      s: s0,
      me,
      opp,
    } = game({ [M.slowking]: 2, [M.reshiram]: 2, [M.psychic]: 8 }, { [M.megaKangaskhan]: 2 });
    swapActiveTo(s0, me, M.slowking);
    attachFromDeck(s0, me, M.psychic);
    attachFromDeck(s0, me, M.psychic);
    swapActiveTo(s0, opp, M.megaKangaskhan);
    const top = giveCard(s0, me, M.reshiram);
    s0.players[me].hand = s0.players[me].hand.filter((u) => u !== top);
    s0.players[me].deck.unshift(top);
    let s = attack(s0);
    s = answer(s, '1');
    expect(s.players[opp].active!.damage).toBe(170);
    expect(s.players[me].discard).toContain(top);
  });

  test("Kyurem's Trifrost, used through Seek Inspiration, does 110 to 3 of the opponent's Pokémon", () => {
    const {
      s: s0,
      me,
      opp,
    } = game({ [M.slowking]: 2, [M.kyurem]: 2, [M.psychic]: 8 }, { [M.megaKangaskhan]: 4 });
    swapActiveTo(s0, me, M.slowking);
    attachFromDeck(s0, me, M.psychic);
    attachFromDeck(s0, me, M.psychic);
    swapActiveTo(s0, opp, M.megaKangaskhan);
    benchFromHand(s0, opp, giveCard(s0, opp, M.megaKangaskhan));
    benchFromHand(s0, opp, giveCard(s0, opp, M.megaKangaskhan));
    const top = giveCard(s0, me, M.kyurem);
    s0.players[me].hand = s0.players[me].hand.filter((u) => u !== top);
    s0.players[me].deck.unshift(top);
    const s = resolvePrompts(attack(s0));
    expect([s.players[opp].active!, ...s.players[opp].bench].map((p) => p.damage)).toEqual([110, 110, 110]);
    // Trifrost discards all Energy from the attacking Pokémon.
    expect(s.players[me].active!.energy).toHaveLength(0);
  });

  test("Ciphermaniac's Codebreaking puts the 2 chosen cards on top in the chosen order", () => {
    const { s: s0, me } = game({ [M.ciphermaniac]: 2, [M.lillie]: 2, [M.ultraBall]: 2 });
    let s = act(engine, s0, { type: 'playTrainer', uid: inHand(s0, me, M.ciphermaniac) });
    s = pickCard(s, M.lillie);
    s = pickCard(s, M.ultraBall);
    s = pickCard(s, M.ultraBall);
    expect(s.cards[s.players[me].deck[0]!]!.defId).toBe(M.ultraBall);
    expect(s.cards[s.players[me].deck[1]!]!.defId).toBe(M.lillie);
  });
});

describe('Crustle deck', () => {
  test('Crustle takes no damage from Pokémon ex, but does from others', () => {
    const hit = (attacker: string) => {
      const { s: s0, me, opp } = game({ [attacker]: 2 }, { [M.crustle]: 2 });
      swapActiveTo(s0, me, attacker);
      for (let i = 0; i < 3; i++) attachFromDeck(s0, me, M.darkness);
      swapActiveTo(s0, opp, M.crustle);
      return attack(s0).players[opp].active?.damage ?? 999;
    };
    expect(hit(M.megaKangaskhan)).toBe(0);
    expect(hit(M.dudunsparce)).toBe(90);
  });

  test('Dwebble evolves itself from the deck with Ascension', () => {
    const { s: s0, me } = game({ [M.dwebble]: 2, [M.crustle]: 2 });
    swapActiveTo(s0, me, M.dwebble);
    attachFromDeck(s0, me, M.darkness);
    let s = attack(s0);
    s = pickCard(s, M.crustle);
    expect(s.cards[s.players[me].active!.stack.at(-1)!]!.defId).toBe(M.crustle);
  });

  test('Growing Grass Energy gives a Grass Pokémon +20 HP, and Spiky Energy hurts the attacker', () => {
    const env = { registry, ruleset: standard2026 };
    const {
      s: s0,
      me,
      opp,
    } = game({ [M.dudunsparce]: 2 }, { [M.crustle]: 2, [M.growingGrass]: 2, [M.spiky]: 2 });
    swapActiveTo(s0, opp, M.crustle);
    const before = maxHp(env, s0, active(opp));
    attachFromDeck(s0, opp, M.growingGrass);
    expect(maxHp(env, s0, active(opp))).toBe(before + 20);
    attachFromDeck(s0, opp, M.spiky);
    swapActiveTo(s0, me, M.dudunsparce);
    for (let i = 0; i < 3; i++) attachFromDeck(s0, me, M.darkness);
    const s = attack(s0);
    expect(s.players[me].active!.damage).toBe(20);
  });

  test("Xerosic's Machinations makes the opponent discard down to 3", () => {
    const { s: s0, me, opp } = game({ [M.xerosic]: 2 });
    let s = act(engine, s0, { type: 'playTrainer', uid: inHand(s0, me, M.xerosic) });
    s = resolvePrompts(s);
    expect(s.players[opp].hand).toHaveLength(3);
  });

  test('Special Red Card needs the opponent at 3 Prizes or fewer, then they draw 3', () => {
    const { s: s0, me, opp } = game({ [M.redCard]: 1 });
    const uid = inHand(s0, me, M.redCard);
    expect(engine.getLegalActions(s0, me).some((a) => a.type === 'playTrainer' && a.uid === uid)).toBe(false);
    s0.players[opp].deck.push(...s0.players[opp].prizes.splice(0, 3));
    const s = act(engine, s0, { type: 'playTrainer', uid });
    expect(s.players[opp].hand).toHaveLength(3);
  });

  test('Prime Catcher switches in their Benched Pokémon and yours', () => {
    const { s: s0, me, opp } = game({ [M.primeCatcher]: 1, [M.megaKangaskhan]: 2 }, { [M.dreepy]: 4 });
    benchFromHand(s0, opp, giveCard(s0, opp, M.dreepy));
    const theirs = s0.players[opp].bench[0]!.stack[0];
    benchFromHand(s0, me, giveCard(s0, me, M.megaKangaskhan));
    const mine = s0.players[me].bench[0]!.stack[0];
    const s = resolvePrompts(act(engine, s0, { type: 'playTrainer', uid: inHand(s0, me, M.primeCatcher) }));
    expect(s.players[opp].active!.stack[0]).toBe(theirs);
    expect(s.players[me].active!.stack[0]).toBe(mine);
  });
});

describe('card text fidelity (meta card audit)', () => {
  const ERI = 'sv05-146';

  test("Munkidori's Adrena-Brain moves nothing when the counters can't be placed (Battle Cage on the opponent's Bench)", () => {
    const { s: s0, me, opp } = game({ [M.munkidori]: 2, [M.darkness]: 4 }, { [M.battleCage]: 2 });
    swapActiveTo(s0, me, M.munkidori);
    attachFromDeck(s0, me, M.darkness);
    s0.players[me].active!.damage = 50;
    benchFromHand(s0, opp, giveCard(s0, opp, M.dreepy));
    const cage = giveCard(s0, opp, M.battleCage);
    s0.players[opp].hand = s0.players[opp].hand.filter((u) => u !== cage);
    s0.stadium = { uid: cage, owner: opp };
    let s = act(engine, s0, ability(me, 'Adrena-Brain'));
    s = pickSlot(s, active(me));
    s = pickSlot(s, { player: opp, zone: 'bench', index: 0 });
    s = answer(s, '3');
    expect(s.players[opp].bench[0]!.damage).toBe(0);
    // Nothing was placed, so nothing is taken off Munkidori either.
    expect(s.players[me].active!.damage).toBe(50);
  });

  test('Pokémon Tools are Items: they cannot be played while Items are locked', () => {
    const { s: s0, me, opp } = game({ [M.budew]: 2 }, { [M.luckyHelmet]: 4 });
    swapActiveTo(s0, me, M.budew);
    giveCard(s0, opp, M.luckyHelmet);
    const s = attack(s0);
    expect(s.current).toBe(opp);
    const tools = engine
      .getLegalActions(s, opp)
      .filter((a) => a.type === 'playTrainer' && s.cards[a.uid]!.defId === M.luckyHelmet);
    expect(tools).toEqual([]);
  });

  test('Eri can discard Pokémon Tools (they are Item cards)', () => {
    const { s: s0, me, opp } = game({ [ERI]: 2 }, { [M.luckyHelmet]: 2 });
    giveCard(s0, opp, M.luckyHelmet);
    const s = act(engine, s0, { type: 'playTrainer', uid: inHand(s0, me, ERI) });
    const offered = (s.prompt?.options ?? []).map((o) => o.uid && s.cards[o.uid]!.defId);
    expect(offered).toContain(M.luckyHelmet);
  });

  test("Special Red Card shuffles the opponent's hand before putting it on the bottom of their deck", () => {
    let shuffled = false;
    for (let seed = 1; seed <= 6 && !shuffled; seed++) {
      const { s: s0, me, opp } = game({ [M.redCard]: 2 }, { [M.redCard]: 2 }, { seed });
      s0.players[opp].prizes.splice(3);
      const hand = [...s0.players[opp].hand];
      const s = act(engine, s0, { type: 'playTrainer', uid: inHand(s0, me, M.redCard) });
      const bottom = s.players[opp].deck.slice(-hand.length);
      expect([...bottom].sort()).toEqual([...hand].sort());
      if (bottom.join() !== hand.join()) shuffled = true;
    }
    expect(shuffled).toBe(true);
  });
});
