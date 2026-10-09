import { applyCondition, type Condition } from './conditions.ts';
import type { Env } from './env.ts';
import { IllegalActionError } from './errors.ts';
import { coinFlip, shuffle } from './rng.ts';
import { clearActiveEffects, defOf, getSlot, newSlot, other, slotDef } from './state.ts';
import type {
  EffectSource,
  GameState,
  MarkerKind,
  Origin,
  PlayerId,
  PokemonSlot,
  Prompt,
  PromptOption,
  SlotRef,
} from './types.ts';
import { drawCards, removeFrom, shuffleDeck } from './zones.ts';

export type CardZone = 'hand' | 'deck' | 'deckBottom' | 'discard';

export const slotKey = (ref: SlotRef): string =>
  ref.zone === 'active' ? `p${ref.player}-active` : `p${ref.player}-bench${ref.index}`;

/** Thrown inside an effect when it needs an answer that has not been given yet. */
class NeedInput {
  constructor(readonly prompt: Prompt) {}
}

/**
 * The only way effect code touches the game. Choices are answered from the recorded
 * answer list; when the answers run out the effect is suspended (see runEffect).
 */
export class EffectCtx {
  private cursor = 0;
  source: EffectSource | null = null;

  constructor(
    public state: GameState,
    readonly env: Env,
    /** The player whose action or card started this effect. */
    public me: PlayerId,
    private readonly answers: readonly string[],
  ) {}

  get opp(): PlayerId {
    return other(this.me);
  }

  def(uid: string) {
    return defOf(this.env, this.state, uid);
  }

  slot(ref: SlotRef): PokemonSlot {
    const slot = getSlot(this.state, ref);
    if (!slot) throw new Error(`No Pokémon at ${slotKey(ref)}`);
    return slot;
  }

  log(text: string, type = 'effect'): void {
    this.state.log.push({ type, player: this.me, text });
  }

  /** "During your next turn, this Pokémon can't use <attack>." */
  lockAttack(ref: SlotRef, attackName: string): void {
    this.slot(ref).attackLocks[attackName] = this.state.turn + 2;
  }

  /**
   * A timed effect on the Pokémon at `ref`. By default it lasts through the opponent's next turn;
   * `turns = 2` makes it last through the owner's next turn ("during your next turn").
   * Markers that have already expired are dropped.
   */
  addMarker(ref: SlotRef, kind: MarkerKind, amount = 0, turns = 1): void {
    const slot = this.slot(ref);
    const live = slot.markers.filter((m) => m.untilTurn >= this.state.turn);
    slot.markers = [...live, { kind, amount, untilTurn: this.state.turn + turns }];
  }

  /** Whether the acting player played the Supporter named `name` this turn. */
  playedSupporterThisTurn(name: string): boolean {
    const played = this.state.players[this.me].supporterPlayed;
    return played?.turn === this.state.turn && played.name === name;
  }

  /** `player` can't play Stadium cards from their hand during their next turn. */
  lockStadium(player: PlayerId): void {
    this.state.players[player].stadiumLockedTurn = this.state.turn + 1;
  }

  /** Damage to the acting player's own Active Pokémon (no Weakness/Resistance). */
  damageSelf(amount: number): void {
    const slot = this.slot({ player: this.me, zone: 'active' });
    slot.damage += amount;
    this.log(`${slotDef(this.env, this.state, slot).name} does ${amount} damage to itself`);
  }

  /** Make a card's passive hooks apply for its owner for the rest of this turn. */
  addLingering(defId: string): void {
    this.state.lingering.push({ defId, owner: this.me, turn: this.state.turn });
  }

  wasKnockedOutLastOpponentTurn(player: PlayerId): boolean {
    return this.state.players[player].lastKnockedOutTurn === this.state.turn - 1;
  }

  usedAbilityNameThisTurn(name: string): boolean {
    return this.state.players[this.me].abilityNamesUsedTurn[name] === this.state.turn;
  }

  markAbilityName(name: string): void {
    this.state.players[this.me].abilityNamesUsedTurn[name] = this.state.turn;
  }

  /** Show cards to both players (e.g. a card searched out and "revealed"). */
  reveal(uids: string[]): void {
    if (uids.length === 0) return;
    const owner = this.state.cards[uids[0]!]!.owner;
    this.state.log.push({
      type: 'reveal',
      player: owner,
      text: `Player ${owner + 1} reveals ${uids.map((u) => this.def(u).name).join(', ')}`,
    });
  }

  draw(player: PlayerId, n: number): string[] {
    return drawCards(this.state, player, n);
  }

  shuffleDeck(player: PlayerId): void {
    shuffleDeck(this.state, player);
  }

  flipCoin(): boolean {
    const [heads, rng] = coinFlip(this.state.rng);
    this.state.rng = rng;
    this.state.log.push({
      type: 'coinFlip',
      player: this.me,
      text: heads ? 'Coin flip: heads' : 'Coin flip: tails',
    });
    return heads;
  }

  /** Remove a card from whichever hand/deck/discard/prize zone holds it. */
  private take(uid: string): void {
    const owner = this.state.cards[uid]!.owner;
    const p = this.state.players[owner];
    for (const zone of ['hand', 'deck', 'discard', 'prizes'] as const) {
      if (p[zone].includes(uid)) {
        removeFrom(p[zone], uid);
        return;
      }
    }
    throw new Error(`Card ${uid} is not in a hand, deck, discard pile or prizes`);
  }

  moveCard(uid: string, to: { player: PlayerId; zone: CardZone }): void {
    this.take(uid);
    const p = this.state.players[to.player];
    if (to.zone === 'deckBottom') p.deck.push(uid);
    else if (to.zone === 'deck') p.deck.unshift(uid);
    else p[to.zone].push(uid);
  }

  /** Put a Basic Pokémon card from hand/deck/discard onto its owner's Bench. */
  putOnBench(player: PlayerId, uid: string): SlotRef {
    this.take(uid);
    const bench = this.state.players[player].bench;
    bench.push(newSlot(uid, this.state.turn));
    const ref: SlotRef = { player, zone: 'bench', index: bench.length - 1 };
    this.log(`${this.def(uid).name} is put onto the Bench`);
    const stadium = this.state.stadium;
    if (stadium && player === this.state.current) {
      this.env.registry.scripts[this.state.cards[stadium.uid]!.defId]?.stadium?.onBenchFromHand?.(this, ref);
    }
    return ref;
  }

  discardStadium(): void {
    const stadium = this.state.stadium;
    if (!stadium) return;
    this.state.players[stadium.owner].discard.push(stadium.uid);
    this.state.stadium = null;
    this.log(`${this.def(stadium.uid).name} is discarded`);
  }

  /** A shuffled copy of `list`, using the game's RNG. */
  shuffled<T>(list: readonly T[]): T[] {
    const [out, rng] = shuffle(list, this.state.rng);
    this.state.rng = rng;
    return out;
  }

  /** Move attached Energy cards from a Pokémon to their owner's hand or discard pile. */
  detachEnergy(ref: SlotRef, uids: string[], zone: 'hand' | 'discard'): void {
    const slot = this.slot(ref);
    for (const uid of uids) {
      removeFrom(slot.energy, uid);
      this.state.players[this.state.cards[uid]!.owner][zone].push(uid);
    }
  }

  attachEnergy(uid: string, ref: SlotRef): void {
    this.take(uid);
    this.slot(ref).energy.push(uid);
    this.log(`${this.def(uid).name} is attached to ${slotDef(this.env, this.state, this.slot(ref)).name}`);
  }

  discardEnergy(ref: SlotRef, uids: string[]): void {
    this.detachEnergy(ref, uids, 'discard');
  }

  /** Evolve the Pokémon at `ref` with an evolution card from its owner's hand. */
  evolve(ref: SlotRef, uid: string): void {
    const slot = this.slot(ref);
    const from = slotDef(this.env, this.state, slot).name;
    this.take(uid);
    slot.stack.push(uid);
    slot.evolvedTurn = this.state.turn;
    slot.conditions = { rotation: 'none', poisoned: false, burned: false };
    slot.cantAttackOnTurn = null;
    slot.attackLocks = {};
    slot.markers = [];
    this.state.log.push({
      type: 'evolve',
      player: ref.player,
      text: `${from} evolves into ${this.def(uid).name}`,
    });
  }

  /** Give the Pokémon at `ref` a Special Condition. */
  applyCondition(ref: SlotRef, c: Condition): void {
    const slot = this.slot(ref);
    applyCondition(slot, c);
    this.log(`${slotDef(this.env, this.state, slot).name} is now ${c[0]!.toUpperCase()}${c.slice(1)}`);
  }

  heal(ref: SlotRef, hp: number): void {
    const slot = this.slot(ref);
    slot.damage = Math.max(0, slot.damage - hp);
  }

  placeCounters(ref: SlotRef, n: number): void {
    this.slot(ref).damage += n * 10;
  }

  /**
   * Put the Pokémon at `ref` (with its evolution cards, Energy and Tool) in its owner's discard pile. No Prize
   * is taken. The engine's Knock Out check after the action promotes a new Active Pokémon, or ends the game
   * if the owner has none left.
   */
  discardSlot(ref: SlotRef): void {
    const slot = this.slot(ref);
    const p = this.state.players[ref.player];
    const name = slotDef(this.env, this.state, slot).name;
    p.discard.push(...slot.stack, ...slot.energy, ...(slot.tool ? [slot.tool] : []));
    if (ref.zone === 'active') p.active = null;
    else p.bench.splice(ref.index, 1);
    this.log(`${name} is discarded`);
  }

  /** Swap a player's Active Pokémon with one of their Benched Pokémon. */
  switchActive(player: PlayerId, benchIndex: number): void {
    const p = this.state.players[player];
    const incoming = p.bench[benchIndex];
    if (!incoming || !p.active) throw new Error('Nothing to switch');
    clearActiveEffects(p.active); // effects on the Active end when it moves to the Bench
    p.bench[benchIndex] = p.active;
    p.active = incoming;
    incoming.becameActiveTurn = this.state.turn;
  }

  chooseSlot(o: {
    player: PlayerId;
    among: SlotRef[];
    min: number;
    max: number;
    message: string;
  }): SlotRef[] {
    const options: PromptOption[] = o.among.map((ref) => ({
      id: slotKey(ref),
      label: slotDef(this.env, this.state, this.slot(ref)).name,
      slot: ref,
    }));
    const ids = this.choose('slot', o.player, options, o.min, o.max, o.message);
    return ids.map((id) => options.find((opt) => opt.id === id)!.slot!);
  }

  chooseOption(o: { player: PlayerId; options: { id: string; label: string }[]; message: string }): string {
    const [id] = this.choose('option', o.player, o.options, 1, 1, o.message);
    return id!;
  }

  chooseCards(o: { player: PlayerId; from: string[]; min: number; max: number; message: string }): string[] {
    const options: PromptOption[] = o.from.map((uid) => ({
      id: uid,
      label: this.def(uid).name,
      uid,
      defId: this.state.cards[uid]!.defId,
    }));
    return this.choose('cards', o.player, options, o.min, o.max, o.message);
  }

  protected choose(
    kind: Prompt['kind'],
    player: PlayerId,
    options: PromptOption[],
    minIn: number,
    maxIn: number,
    message: string,
  ): string[] {
    const max = Math.min(maxIn, options.length);
    const min = Math.min(minIn, max);
    if (max === 0) return [];
    if (options.length === min && min === max) return options.map((o) => o.id);
    const selected: string[] = [];
    while (selected.length < max) {
      const available = options.filter((opt) => !selected.includes(opt.id));
      if (this.cursor >= this.answers.length) {
        throw new NeedInput({ player, kind, message, options: available, min, max, selected: [...selected] });
      }
      const answer = this.answers[this.cursor++]!;
      if (answer === 'done') {
        if (selected.length < min) throw new IllegalActionError(`Choose at least ${min}`);
        break;
      }
      if (!available.some((opt) => opt.id === answer))
        throw new IllegalActionError(`Not an option: ${answer}`);
      selected.push(answer);
    }
    return selected;
  }
}

export type EffectFn = (ctx: EffectCtx) => void;

/**
 * Run `fn` on a copy of `before`. If it completes, return the new state. If it needs
 * input, return the partially resolved state (so players see what happened so far)
 * with the prompt and a pending record; the answer replays the effect from `before`.
 */
export function runEffect(
  env: Env,
  before: GameState,
  origin: Origin,
  player: PlayerId,
  fn: EffectFn,
  answers: string[] = [],
): GameState {
  const work = structuredClone(before);
  work.prompt = null;
  work.pending = null;
  const ctx = new EffectCtx(work, env, player, answers);
  try {
    fn(ctx);
    return ctx.state;
  } catch (e) {
    if (!(e instanceof NeedInput)) throw e;
    const snapshot = structuredClone(before);
    snapshot.prompt = null;
    snapshot.pending = null;
    const paused = ctx.state;
    paused.prompt = e.prompt;
    paused.pending = { snapshot, origin, player, answers: [...answers] };
    return paused;
  }
}
