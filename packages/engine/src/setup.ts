import type { EffectCtx } from './effects.ts';
import { runEffect } from './effects.ts';
import type { Env } from './env.ts';
import { coinFlip } from './rng.ts';
import { isBasicPokemon, log, newSlot } from './state.ts';
import { beginTurn } from './turn.ts';
import type { CardInstance, DeckList, GameState, PlayerId, PlayerState } from './types.ts';
import { drawCards, removeFrom, shuffleDeck } from './zones.ts';

function emptyPlayer(): PlayerState {
  return {
    deck: [],
    hand: [],
    discard: [],
    prizes: [],
    active: null,
    bench: [],
    supporterTurn: null,
    energyTurn: null,
    retreatTurn: null,
    stadiumUsedTurn: null,
    stadiumPlayedTurn: null,
    mulligans: 0,
    lastKnockedOutTurn: null,
    abilityNamesUsedTurn: {},
  };
}

function validateDeck(env: Env, deck: DeckList): void {
  const total = deck.cards.reduce((n, c) => n + c.count, 0);
  if (total !== env.ruleset.deckSize)
    throw new Error(`${deck.name}: deck must have ${env.ruleset.deckSize} cards, has ${total}`);
  for (const c of deck.cards)
    if (!env.registry.defs[c.id]) throw new Error(`${deck.name}: unknown card ${c.id}`);
  const hasBasic = deck.cards.some((c) => {
    const d = env.registry.defs[c.id];
    return d?.category === 'Pokemon' && d.stage === 'Basic';
  });
  if (!hasBasic) throw new Error(`${deck.name}: deck needs at least one Basic Pokémon`);
}

export function createGame(env: Env, config: { decks: [DeckList, DeckList]; seed: number }): GameState {
  const cards: Record<string, CardInstance> = {};
  const state: GameState = {
    cards,
    players: [emptyPlayer(), emptyPlayer()],
    turn: 0,
    current: 0,
    first: 0,
    phase: 'setup',
    stadium: null,
    prompt: null,
    pending: null,
    rng: config.seed >>> 0,
    result: null,
    log: [],
    lingering: [],
  };
  for (const player of [0, 1] as PlayerId[]) {
    const deck = config.decks[player];
    validateDeck(env, deck);
    let n = 0;
    for (const c of deck.cards) {
      for (let i = 0; i < c.count; i++) {
        const uid = `p${player}-c${n++}`;
        cards[uid] = { uid, defId: c.id, owner: player };
        state.players[player].deck.push(uid);
      }
    }
  }
  // Shuffle, draw 7, mulligan until the hand has a Basic.
  for (const player of [0, 1] as PlayerId[]) {
    const p = state.players[player];
    for (;;) {
      shuffleDeck(state, player);
      drawCards(state, player, env.ruleset.handSize);
      if (p.hand.some((uid) => isBasicPokemon(env, state, uid))) break;
      p.mulligans++;
      log(state, 'mulligan', `Player ${player + 1} reveals a hand with no Basic Pokémon and mulligans`, {
        player,
      });
      p.deck.push(...p.hand.splice(0));
    }
  }
  // Each player draws one card for every mulligan their opponent took.
  // Simultaneous mulligans give no bonus: each player draws only for the opponent's extra mulligans.
  const [m0, m1] = [state.players[0].mulligans, state.players[1].mulligans];
  drawCards(state, 0, Math.max(0, m1 - m0));
  drawCards(state, 1, Math.max(0, m0 - m1));
  const [heads, rng] = coinFlip(state.rng);
  state.rng = rng;
  state.first = heads ? 0 : 1;
  log(state, 'coinFlip', `Player ${state.first + 1} wins the coin flip and goes first`);
  return runEffect(env, state, { type: 'setup' }, 0, setupEffect);
}

export function setupEffect(ctx: EffectCtx): void {
  const s = ctx.state;
  const env = ctx.env;
  for (const player of [0, 1] as PlayerId[]) {
    const p = s.players[player];
    const basics = () => p.hand.filter((uid) => isBasicPokemon(env, s, uid));
    const [active] = ctx.chooseCards({
      player,
      from: basics(),
      min: 1,
      max: 1,
      message: 'Choose your Active Pokémon',
    });
    removeFrom(p.hand, active!);
    p.active = newSlot(active!, 0);
    const bench = ctx.chooseCards({
      player,
      from: basics(),
      min: 0,
      max: env.ruleset.benchSize,
      message: 'Choose Basic Pokémon to put on your Bench',
    });
    for (const uid of bench) {
      removeFrom(p.hand, uid);
      p.bench.push(newSlot(uid, 0));
    }
  }
  for (const player of [0, 1] as PlayerId[]) {
    const p = s.players[player];
    p.prizes = p.deck.splice(0, env.ruleset.prizeCount);
  }
  s.phase = 'main';
  s.turn = 1;
  s.current = s.first;
  beginTurn(ctx);
}
