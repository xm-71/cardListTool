import {
  shuffle,
  type CardInstance,
  type CardRegistry,
  type DeckList,
  type GameState,
  type PlayerId,
  type PlayerState,
  type PlayerView,
  type PokemonSlot,
  type SlotView,
} from '@ptcg/engine';

/**
 * Build a full GameState consistent with what `view.me` can see. Visible cards keep their
 * uids; every hidden card (decks, prizes, the opponent's hand) is a random guess drawn from
 * what is left of that player's decklist. Uses only the view and the public decklists.
 */
export function determinize(
  view: PlayerView,
  decks: [DeckList, DeckList],
  _registry: CardRegistry,
  rngIn: number,
): { state: GameState; rng: number } {
  let rng = rngIn >>> 0;
  const me = view.me;
  const cards: Record<string, CardInstance> = {};
  const see = (c: CardInstance) => (cards[c.uid] = { ...c });
  const seeSlot = (s: SlotView | null) => {
    if (!s) return;
    s.stack.forEach(see);
    s.energy.forEach(see);
    if (s.tool) see(s.tool);
  };
  for (const side of [view.you, view.opponent]) {
    seeSlot(side.active);
    side.bench.forEach(seeSlot);
    side.discard.forEach(see);
  }
  view.you.hand.forEach(see);
  if (view.stadium) see(view.stadium.card);

  const hidden: Record<PlayerId, { deck: string[]; prizes: string[]; hand: string[] }> = {
    0: { deck: [], prizes: [], hand: [] },
    1: { deck: [], prizes: [], hand: [] },
  };
  for (const p of [0, 1] as PlayerId[]) {
    const remaining: Record<string, number> = {};
    for (const c of decks[p].cards) remaining[c.id] = (remaining[c.id] ?? 0) + c.count;
    for (const c of Object.values(cards))
      if (c.owner === p) remaining[c.defId] = (remaining[c.defId] ?? 0) - 1;
    const pool: string[] = [];
    for (const [defId, n] of Object.entries(remaining)) {
      if (n < 0) throw new Error(`View has more ${defId} than player ${p + 1}'s decklist`);
      for (let i = 0; i < n; i++) pool.push(defId);
    }
    const [shuffled, next] = shuffle(pool, rng);
    rng = next;
    const side = p === me ? view.you : view.opponent;
    const handCount = p === me ? 0 : view.opponent.handCount;
    if (shuffled.length !== side.deckCount + side.prizeCount + handCount) {
      throw new Error(`Hidden card count mismatch for player ${p + 1}`);
    }
    const uids = shuffled.map((defId, k) => {
      const uid = `p${p}-h${k}`;
      cards[uid] = { uid, defId, owner: p };
      return uid;
    });
    hidden[p].hand = uids.slice(0, handCount);
    hidden[p].prizes = uids.slice(handCount, handCount + side.prizeCount);
    hidden[p].deck = uids.slice(handCount + side.prizeCount);
  }

  const toSlot = (s: SlotView): PokemonSlot => ({
    stack: s.stack.map((c) => c.uid),
    energy: s.energy.map((c) => c.uid),
    tool: s.tool?.uid ?? null,
    damage: s.damage,
    conditions: { ...s.conditions },
    enteredTurn: s.enteredTurn,
    evolvedTurn: s.evolvedTurn,
    abilityUsedTurn: { ...s.abilityUsedTurn },
    cantAttackOnTurn: s.cantAttackOnTurn,
    attackLocks: { ...s.attackLocks },
  });
  const player = (p: PlayerId): PlayerState => {
    const side = p === me ? view.you : view.opponent;
    const mine = p === me ? view.you : null;
    return {
      deck: hidden[p].deck,
      hand: mine ? mine.hand.map((c) => c.uid) : hidden[p].hand,
      discard: side.discard.map((c) => c.uid),
      prizes: hidden[p].prizes,
      active: side.active ? toSlot(side.active) : null,
      bench: side.bench.map(toSlot),
      supporterTurn: mine?.supporterTurn ?? null,
      energyTurn: mine?.energyTurn ?? null,
      retreatTurn: mine?.retreatTurn ?? null,
      stadiumUsedTurn: mine?.stadiumUsedTurn ?? null,
      stadiumPlayedTurn: mine?.stadiumPlayedTurn ?? null,
      mulligans: mine?.mulligans ?? 0,
      lastKnockedOutTurn: side.lastKnockedOutTurn,
      abilityNamesUsedTurn: { ...(mine?.abilityNamesUsedTurn ?? {}) },
    };
  };
  const state: GameState = {
    cards,
    players: [player(0), player(1)],
    turn: view.turn,
    current: view.current,
    first: view.first,
    phase: view.phase,
    stadium: view.stadium ? { uid: view.stadium.card.uid, owner: view.stadium.owner } : null,
    prompt: null,
    pending: null,
    rng,
    result: view.result,
    log: [],
    lingering: structuredClone(view.lingering),
  };
  return { state, rng };
}
