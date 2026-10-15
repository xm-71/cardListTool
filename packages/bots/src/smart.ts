import {
  standard2026,
  type Action,
  type CardDef,
  type CardInstance,
  type CardRegistry,
  type EnergyType,
  type PlayerView,
  type PokemonDef,
  type PromptOption,
  type SlotRef,
  type SlotView,
} from '@ptcg/engine';
import type { DamageCache } from './damage.ts';
import type { DeckPlan } from './plan.ts';
import { trainerRole } from './roles.ts';

type Answer = Extract<Action, { type: 'answer' }>;

/** Energy still missing to pay `cost` from the attached Energy (typed first, then Colorless). */
function missing(cost: EnergyType[], have: EnergyType[]): number {
  const pool = [...have];
  let short = 0;
  for (const t of cost.filter((c) => c !== 'Colorless')) {
    const i = pool.indexOf(t);
    if (i >= 0) pool.splice(i, 1);
    else short++;
  }
  return short + Math.max(0, cost.filter((c) => c === 'Colorless').length - pool.length);
}

/** What a bot knows about a position: card lookups and the damage it expects from its own attacks. */
export interface Reader {
  view: PlayerView;
  registry: CardRegistry;
  plan: DeckPlan;
  damage?: DamageCache;
  def(card: CardInstance): CardDef;
  top(slot: SlotView): PokemonDef;
  provides(slot: SlotView): EnergyType[];
  slotAt(ref: SlotRef): SlotView | null;
  /** Damage `slot`'s attack `index` would deal to `target` (Weakness and Resistance applied). */
  attackDamage(slot: SlotView, index: number, target: PokemonDef | null): number;
  /** The best attack `slot` can pay for now, against `target`; 0 when it cannot attack. */
  bestNow(slot: SlotView, target: PokemonDef | null): number;
  /** Energy missing for the attack of `slot` that is closest to payable (Infinity without attacks). */
  need(slot: SlotView): number;
  inLines(name: string): boolean;
}

export function reader(
  view: PlayerView,
  registry: CardRegistry,
  plan: DeckPlan,
  damage?: DamageCache,
): Reader {
  const def = (c: CardInstance): CardDef => registry.defs[c.defId]!;
  const top = (slot: SlotView): PokemonDef => def(slot.stack[slot.stack.length - 1]!) as PokemonDef;
  const provides = (slot: SlotView): EnergyType[] =>
    slot.energy.flatMap((c) => {
      const d = def(c);
      return d.category === 'Energy' ? d.provides : [];
    });
  const lineNames = new Set(plan.attackers.flatMap((a) => plan.lines[a] ?? [a]));
  const r: Reader = {
    view,
    registry,
    plan,
    damage,
    def,
    top,
    provides,
    slotAt(ref) {
      const side = ref.player === view.me ? view.you : view.opponent;
      return ref.zone === 'active' ? side.active : (side.bench[ref.index] ?? null);
    },
    attackDamage(slot, index, target) {
      const d = top(slot);
      const atk = d.attacks[index];
      if (!atk) return 0;
      let dmg = damage?.get(d.id, index, slot.energy.length) ?? atk.damage;
      if (target?.weakness && d.types.includes(target.weakness)) dmg *= 2;
      if (target?.resistance && d.types.includes(target.resistance)) dmg -= 30;
      return Math.max(0, dmg);
    },
    bestNow(slot, target) {
      const have = provides(slot);
      return Math.max(
        0,
        ...top(slot).attacks.map((a, i) =>
          missing(a.cost, have) === 0 ? r.attackDamage(slot, i, target) : 0,
        ),
      );
    },
    need(slot) {
      const have = provides(slot);
      const attacks = top(slot).attacks;
      return attacks.length ? Math.min(...attacks.map((a) => missing(a.cost, have))) : Infinity;
    },
    inLines: (name) => lineNames.has(name),
  };
  return r;
}

const prizeOf = (d: PokemonDef): number => standard2026.prizeValue(d);

/** Pick among slot options. `score` is higher for the better slot. */
function bestSlot(opts: PromptOption[], score: (ref: SlotRef) => number): PromptOption {
  let best = opts[0]!;
  let bestScore = -Infinity;
  for (const o of opts) {
    const s = score(o.slot!);
    if (s > bestScore) {
      best = o;
      bestScore = s;
    }
  }
  return best;
}

function slotAnswer(r: Reader, opts: PromptOption[], message: string): PromptOption {
  const { view } = r;
  const theirs = opts.filter((o) => o.slot && o.slot.player !== view.me);
  const mine = opts.filter((o) => o.slot && o.slot.player === view.me);
  const target = view.opponent.active ? r.top(view.opponent.active) : null;
  if (theirs.length && !/heal/i.test(message)) {
    // Knock Out first (the biggest Prize value among those), else the most Prizes for the least HP left.
    const myActive = view.you.active;
    return bestSlot(theirs, (ref) => {
      const slot = r.slotAt(ref);
      if (!slot) return -Infinity;
      const d = r.top(slot);
      const left = (slot.hp ?? d.hp) - slot.damage;
      const reach = myActive ? r.bestNow(myActive, d) : 0;
      const ko = reach >= left;
      return (ko ? 1000 : 0) + prizeOf(d) * 100 + (slot.damage / (slot.hp ?? d.hp)) * 10 + d.retreat * 0.1;
    });
  }
  if (!mine.length) return opts[0]!;
  if (/heal/i.test(message)) {
    return bestSlot(mine, (ref) => {
      const slot = r.slotAt(ref);
      return slot ? slot.damage * prizeOf(r.top(slot)) : -Infinity;
    });
  }
  if (/from which|move .* from/i.test(message)) {
    // Take from a Pokémon the plan does not rely on, with the most to give.
    return bestSlot(mine, (ref) => {
      const slot = r.slotAt(ref);
      if (!slot) return -Infinity;
      const give = slot.energy.length + slot.damage / 10;
      return (r.inLines(r.top(slot).name) ? 0 : 100) + give;
    });
  }
  if (/attach|to which|move it|move .* to/i.test(message)) {
    return bestSlot(mine, (ref) => {
      const slot = r.slotAt(ref);
      if (!slot) return -Infinity;
      const need = r.need(slot);
      return (
        (need > 0 && need < Infinity ? 100 - need * 10 : 0) +
        (r.inLines(r.top(slot).name) ? 50 : 0) +
        (ref.zone === 'active' ? 5 : 0)
      );
    });
  }
  // Switch in / promote: the Pokémon that can attack now for the most, else the one closest to attacking.
  return bestSlot(mine, (ref) => {
    const slot = r.slotAt(ref);
    if (!slot) return -Infinity;
    const now = r.bestNow(slot, target);
    if (now > 0) return 1000 + now;
    const need = r.need(slot);
    return 500 - Math.min(need, 10) * 50 + (r.inLines(r.top(slot).name) ? 30 : 0) + r.top(slot).hp / 10;
  });
}

const namesOf = (r: Reader, cards: CardInstance[]): string[] => cards.map((c) => r.def(c).name);

/** Names of every Pokémon in play (all cards of each stack, so pre-evolutions count). */
function boardNames(r: Reader): Set<string> {
  const names = new Set<string>();
  for (const slot of [r.view.you.active, ...r.view.you.bench]) {
    for (const c of slot?.stack ?? []) names.add(r.def(c).name);
  }
  return names;
}

/** How much the deck wants this card, for taking it from the deck or discard. Higher is better. */
function wantScore(r: Reader, card: CardInstance, have: string[], board: Set<string>): number {
  const d = r.def(card);
  const { plan } = r;
  if (d.category === 'Pokemon') {
    const owned = have.includes(d.name) || board.has(d.name);
    for (const a of plan.attackers) {
      const line = plan.lines[a] ?? [];
      const at = line.indexOf(d.name);
      if (at < 0) continue;
      const prevHave = at === 0 || have.includes(line[at - 1]!) || board.has(line[at - 1]!);
      if (!owned && prevHave) return 100 - 5 * at;
      if (!owned) return 60 - 5 * at;
      if (at === 0 && have.filter((n) => n === d.name).length + (board.has(d.name) ? 1 : 0) < 2) return 30;
      return 5;
    }
    if (owned) return 5;
    const idx = plan.priority.indexOf(d.name);
    return idx < 0 ? 10 : 50 - Math.min(40, idx * 2);
  }
  if (d.category === 'Energy') {
    const short = [r.view.you.active, ...r.view.you.bench].some(
      (s) => s && r.inLines(r.top(s).name) && r.need(s) > 0,
    );
    return short ? 45 : 15;
  }
  switch (trainerRole(d)) {
    case 'draw':
      return r.view.you.hand.length <= 3 ? 30 : 10;
    case 'search':
      return 25;
    case 'gust':
      return 28;
    case 'evolve':
      return 27;
    default:
      return 20;
  }
}

/** How much a card in hand is worth keeping. Lower goes first. */
function keepScore(r: Reader, card: CardInstance, hand: CardInstance[]): number {
  const d = r.def(card);
  const board = boardNames(r);
  const copies = hand.filter((c) => c.defId === card.defId).length;
  if (d.category === 'Pokemon') {
    const inPlan = r.plan.priority.includes(d.name);
    const isAttacker = r.inLines(d.name);
    if (isAttacker && copies <= 1) return 200;
    if (isAttacker) return 70;
    if (d.evolvesFrom && board.has(d.evolvesFrom)) return 80;
    return inPlan ? 35 : 10;
  }
  if (d.category === 'Energy') {
    const short = [r.view.you.active, ...r.view.you.bench].some(
      (s) => s && r.need(s) > 0 && r.need(s) < Infinity,
    );
    return short && copies <= 2 ? 40 : 8;
  }
  if (d.name === 'Rare Candy' || trainerRole(d) === 'evolve') {
    const waiting =
      hand.some((c) => {
        const x = r.def(c);
        return x.category === 'Pokemon' && x.stage === 'Stage2';
      }) ||
      [r.view.you.active, ...r.view.you.bench].some(
        (s) =>
          s &&
          r.top(s).stage === 'Basic' &&
          r.plan.attackers.some((a) => (r.plan.lines[a]?.length ?? 0) === 3),
      );
    return waiting ? 150 : 15;
  }
  switch (trainerRole(d)) {
    case 'gust':
      return 45;
    case 'draw':
      return 35;
    case 'search':
      return 30;
    case 'switch':
      return 25;
    default:
      return 20;
  }
}

function cardAnswer(r: Reader, prompt: NonNullable<PlayerView['prompt']>, legal: Answer[]): Answer | null {
  const done = legal.find((a) => a.optionId === 'done') ?? null;
  const options = prompt.options.filter((o) => o.uid);
  const byId = new Map(legal.map((a) => [a.optionId, a]));
  const handIds = new Set(r.view.you.hand.map((c) => c.uid));
  const card = (o: PromptOption): CardInstance => ({ uid: o.uid!, defId: o.defId!, owner: r.view.me });
  const fromHand = options.length > 0 && options.every((o) => handIds.has(o.uid!));
  const choosable = options.filter((o) => byId.has(o.id));
  if (!choosable.length) return done;

  if (fromHand) {
    // Discarding: the least useful card first. Past the minimum, only cards that are plainly junk.
    const hand = r.view.you.hand;
    const scored = choosable
      .map((o) => ({ o, keep: keepScore(r, card(o), hand) }))
      .sort((a, b) => a.keep - b.keep);
    if (prompt.selected.length >= prompt.min && done)
      return scored[0]!.keep <= 10 && prompt.min < prompt.max ? byId.get(scored[0]!.o.id)! : done;
    return byId.get(scored[0]!.o.id)!;
  }

  // Taking from the deck or discard pile. Picked cards are no longer offered (their names are unknown to the
  // chooser's view), so each pick already made raises the bar for the next one.
  const have = namesOf(r, r.view.you.hand);
  const board = boardNames(r);
  const scored = choosable
    .map((o) => ({ o, want: wantScore(r, card(o), have, board) }))
    .sort((a, b) => b.want - a.want);
  if (prompt.selected.length >= prompt.min && done && scored[0]!.want < 25 + 30 * prompt.selected.length)
    return done;
  return byId.get(scored[0]!.o.id)!;
}

/**
 * The answer to a prompt, chosen by what the prompt is about (spec: smart policy → Card choices).
 * Always one of `legal`.
 */
export function answerPrompt(
  view: PlayerView,
  legal: Action[],
  plan: DeckPlan,
  registry: CardRegistry,
  damage?: DamageCache,
): Action {
  const answers = legal.filter((a): a is Answer => a.type === 'answer');
  const prompt = view.prompt;
  if (!prompt || answers.length === 0) return legal[0]!;
  const r = reader(view, registry, plan, damage);
  const byId = new Map(answers.map((a) => [a.optionId, a]));
  const options = prompt.options.filter((o) => byId.has(o.id));

  if (prompt.kind === 'slot') {
    const withSlots = options.filter((o) => o.slot);
    if (withSlots.length) return byId.get(slotAnswer(r, withSlots, prompt.message).id)!;
  } else if (prompt.kind === 'cards') {
    const pick = cardAnswer(r, prompt, answers);
    if (pick) return pick;
  } else {
    const yes = byId.get('yes');
    if (yes) return yes;
  }
  return answers.find((a) => a.optionId !== 'done') ?? answers[0]!;
}
