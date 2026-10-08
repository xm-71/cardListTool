import type { CardDef, CardRegistry, CardScript } from '../src/cards.ts';
import type { Action, DeckList, GameState, PlayerId } from '../src/types.ts';
import type { Engine } from '../src/engine.ts';

const base = { regulationMark: 'I', rarity: 'Common', image: '' };

export const TESTMON: CardDef = {
  ...base,
  id: 't-basic',
  name: 'Testmon',
  category: 'Pokemon',
  stage: 'Basic',
  hp: 60,
  types: ['Colorless'],
  evolvesFrom: null,
  weakness: null,
  resistance: null,
  retreat: 1,
  attacks: [{ name: 'Tackle', cost: ['Colorless'], damage: 20, damageSuffix: '', text: '' }],
  abilities: [],
  isEx: false,
  isMega: false,
};

export const TESTEVO: CardDef = {
  ...base,
  id: 't-evo',
  name: 'Testevo',
  category: 'Pokemon',
  stage: 'Stage1',
  hp: 90,
  types: ['Colorless'],
  evolvesFrom: 'Testmon',
  weakness: null,
  resistance: null,
  retreat: 2,
  attacks: [{ name: 'Slam', cost: ['Colorless', 'Colorless'], damage: 50, damageSuffix: '', text: '' }],
  abilities: [],
  isEx: false,
  isMega: false,
};

export const DARK: CardDef = {
  ...base,
  id: 't-dark',
  name: 'Darkness Energy',
  category: 'Energy',
  energyKind: 'Basic',
  provides: ['Darkness'],
  text: '',
};

export const PSY: CardDef = { ...DARK, id: 't-psy', name: 'Psychic Energy', provides: ['Psychic'] };

export const ITEM: CardDef = {
  ...base,
  id: 't-item',
  name: 'Nothing Item',
  category: 'Trainer',
  trainerType: 'Item',
  text: 'Does nothing.',
  isAceSpec: false,
};

/** A small registry; extra defs/scripts can be merged in by individual tests. */
export function miniRegistry(
  extraDefs: CardDef[] = [],
  extraScripts: Record<string, CardScript> = {},
): CardRegistry {
  const defs: Record<string, CardDef> = {};
  for (const d of [TESTMON, TESTEVO, DARK, PSY, ITEM, ...extraDefs]) defs[d.id] = d;
  return { defs, scripts: { ...extraScripts } };
}

export function deckOf(spec: Record<string, number>, name = 'test deck'): DeckList {
  return { name, cards: Object.entries(spec).map(([id, count]) => ({ id, count })) };
}

export function act(engine: Engine, state: GameState, action: Action, player?: PlayerId): GameState {
  const p = player ?? state.prompt?.player ?? state.current;
  return engine.applyAction(state, p, action).state;
}

/** Finish setup: each player picks the first offered Basic as Active and benches nothing. */
export function finishSetup(engine: Engine, state: GameState): GameState {
  let s = state;
  while (s.phase === 'setup' && s.prompt) {
    const pr = s.prompt;
    const optionId = pr.selected.length >= pr.min ? 'done' : pr.options[0]!.id;
    s = act(engine, s, { type: 'answer', optionId });
  }
  return s;
}

/** A game advanced past setup (each side: first Basic offered as Active, empty Bench). */
export function started(
  engine: Engine,
  spec0: Record<string, number> = { 't-basic': 20, 't-evo': 4, 't-dark': 26, 't-psy': 10 },
  spec1: Record<string, number> = spec0,
  seed = 1,
): GameState {
  return finishSetup(engine, engine.createGame({ decks: [deckOf(spec0), deckOf(spec1)], seed }));
}

/** Move a card with the given definition from the player's deck (or prizes/discard) into their hand. */
export function giveCard(state: GameState, player: PlayerId, defId: string): string {
  const p = state.players[player];
  for (const zone of ['deck', 'prizes', 'discard'] as const) {
    const i = p[zone].findIndex((u) => state.cards[u]!.defId === defId);
    if (i >= 0) {
      const [uid] = p[zone].splice(i, 1);
      p.hand.push(uid!);
      return uid!;
    }
  }
  throw new Error(`No ${defId} left outside the hand for player ${player}`);
}

/** Put a card from the player's hand straight onto their Bench (test setup only). */
export function benchFromHand(state: GameState, player: PlayerId, uid: string, enteredTurn = 0): void {
  const p = state.players[player];
  p.hand.splice(p.hand.indexOf(uid), 1);
  p.bench.push({
    stack: [uid],
    energy: [],
    tool: null,
    damage: 0,
    conditions: { rotation: 'none', poisoned: false, burned: false },
    enteredTurn,
    evolvedTurn: null,
    abilityUsedTurn: {},
    cantAttackOnTurn: null,
  });
}

/** Attach an Energy card from the player's deck directly to a slot (test setup only). */
export function attachFromDeck(
  state: GameState,
  player: PlayerId,
  defId: string,
  zone: 'active' | number = 'active',
): string {
  const uid = giveCard(state, player, defId);
  const p = state.players[player];
  p.hand.splice(p.hand.indexOf(uid), 1);
  const slot = zone === 'active' ? p.active! : p.bench[zone]!;
  slot.energy.push(uid);
  return uid;
}

export const has = (actions: Action[], type: Action['type']) => actions.some((a) => a.type === type);

/** Replace a player's Active Pokémon with a card of `defId` taken from their deck (test setup only). */
export function swapActiveTo(state: GameState, player: PlayerId, defId: string): string {
  const p = state.players[player];
  const current = p.active!.stack[0]!;
  if (state.cards[current]!.defId === defId) return current;
  const zone = (['deck', 'hand', 'prizes'] as const).find((z) =>
    p[z].some((u) => state.cards[u]!.defId === defId),
  );
  if (!zone) throw new Error(`No ${defId} outside play`);
  const i = p[zone].findIndex((u) => state.cards[u]!.defId === defId);
  const [uid] = p[zone].splice(i, 1);
  p[zone].push(...p.active!.stack.splice(0));
  p.active!.stack = [uid!];
  return uid!;
}

export function pokemon(id: string, overrides: Partial<Extract<CardDef, { category: 'Pokemon' }>>): CardDef {
  return { ...(TESTMON as Extract<CardDef, { category: 'Pokemon' }>), id, name: id, ...overrides };
}
