import { createEngine, type GameState, type PlayerId } from '@ptcg/engine';
import { act, started } from '@ptcg/engine/testing';
import { buildRegistry } from '../src/registry.ts';

export const registry = buildRegistry();
export const engine = createEngine(registry);
export { act, attachFromDeck, benchFromHand, giveCard, has, swapActiveTo } from '@ptcg/engine/testing';

export const ID = {
  gastly: 'me02-054',
  haunter: 'me02-055',
  megaGengar: 'me02-056',
  toxel: 'me02-067',
  toxtricity: 'me02-068',
  sableye: 'me02-059',
  seviper: 'me02-062',
  eternatus: 'me02-069',
  megaDiancie: 'me02-041',
  meloetta: 'me02-040',
  spoink: 'me01-062',
  grumpig: 'me01-063',
  milcery: 'me02-043',
  alcremie: 'me02-044',
  mimikyu: 'me02-042',
  cresselia: 'me02-039',
  zacian: 'me02-045',
  lillie: 'me01-119',
  arven: 'sv01-166',
  boss: 'me01-114',
  iono: 'sv02-185',
  nestBall: 'sv01-181',
  poffin: 'me01-167',
  ultraBall: 'me01-131',
  rareCandy: 'me01-125',
  nightStretcher: 'me01-173',
  switch: 'me01-130',
  airBalloon: 'me01-166',
  mysteryGarden: 'me01-122',
  research: 'sv09-155',
  wally: 'me01-132',
  riskyRuins: 'me01-127',
  megaSignal: 'me01-121',
  punkHelmet: 'me02-092',
  wondrousPatch: 'me02-094',
  psychic: 'mee-005',
  darkness: 'mee-007',
} as const;

/** A 60-card deck: the given cards, padded with Darkness Energy. */
export function deck(spec: Record<string, number>): Record<string, number> {
  const n = Object.values(spec).reduce((a, b) => a + b, 0);
  return { ...spec, [ID.darkness]: (spec[ID.darkness] ?? 0) + 60 - n };
}

/**
 * A started game. `turn: 2` advances to the second player's first turn; `turn: 3` to the
 * first player's second turn (when evolving and Rare Candy become possible).
 */
export function game(
  spec0: Record<string, number>,
  spec1: Record<string, number> = spec0,
  opts: { turn?: 1 | 2 | 3; seed?: number } = {},
): { s: GameState; me: PlayerId; opp: PlayerId } {
  let s = started(engine, deck(spec0), deck(spec1), opts.seed ?? 1);
  for (let t = 1; t < (opts.turn ?? 2); t++) s = act(engine, s, { type: 'endTurn' });
  const me = s.current;
  return { s, me, opp: me === 0 ? 1 : 0 };
}

export const playTrainer = (uid: string) => ({ type: 'playTrainer', uid }) as const;

/** Answer the current prompt with the options whose card definition id is in `defIds` (in order), then 'done' if still open. */
export function answerCards(s: GameState, defIds: string[]): GameState {
  let st = s;
  for (const defId of defIds) {
    const opt = st.prompt!.options.find((o) => o.uid && st.cards[o.uid]!.defId === defId);
    if (!opt) throw new Error(`No option for ${defId}`);
    st = act(engine, st, { type: 'answer', optionId: opt.id });
    if (!st.prompt) return st;
  }
  return st;
}

export function answer(s: GameState, optionId: string): GameState {
  return act(engine, s, { type: 'answer', optionId });
}

export const defIdsOf = (s: GameState, uids: string[]) => uids.map((u) => s.cards[u]!.defId);

/** A card of `defId` in the player's hand: one already there, or one moved in from elsewhere. */
export function inHand(s: GameState, player: PlayerId, defId: string): string {
  return s.players[player].hand.find((u) => s.cards[u]!.defId === defId) ?? giveCardRaw(s, player, defId);
}
import { giveCard as giveCardRaw } from '@ptcg/engine/testing';
