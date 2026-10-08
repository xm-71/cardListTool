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
