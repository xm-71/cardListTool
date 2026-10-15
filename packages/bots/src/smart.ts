import {
  nextRandom,
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
import type { DeckList } from '@ptcg/engine';
import type { DamageCache } from './damage.ts';
import { deckPlan, type DeckPlan } from './plan.ts';
import { trainerRole } from './roles.ts';
import type { Bot } from './types.ts';

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
  /** Energy missing for the strongest attack of `slot` (Infinity without attacks). */
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
      if (!attacks.length) return Infinity;
      // Follow the strongest attack; with no damage anywhere, the cheapest one.
      let best = 0;
      attacks.forEach((a, i) => {
        const here = r.attackDamage(slot, i, null);
        const bestHere = r.attackDamage(slot, best, null);
        if (
          here > bestHere ||
          (here === bestHere && missing(a.cost, have) < missing(attacks[best]!.cost, have))
        )
          best = i;
      });
      return missing(attacks[best]!.cost, have);
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

const MAX_BENCH = 5;

/**
 * The smart policy (spec: Smart policy → Turn order). Plays either seat: a plan is built for each deck once.
 * Not a difficulty on its own; Medium and Hard use it for prompt answers and to play out turns in their look-ahead.
 */
export function createSmartBot(
  registry: CardRegistry,
  decks: [DeckList, DeckList],
  damage?: DamageCache,
): Bot {
  const plans = [deckPlan(decks[0], registry), deckPlan(decks[1], registry)] as const;

  return (view, legal, rngIn) => {
    let rng = rngIn;
    const pick = <T>(xs: T[]): T => {
      const [v, next] = nextRandom(rng);
      rng = next;
      return xs[Math.floor(v * xs.length)]!;
    };
    const done = (action: Action) => ({ action, rng });
    const of = <K extends Action['type']>(type: K) =>
      legal.filter((a): a is Extract<Action, { type: K }> => a.type === type);
    const plan = plans[view.me]!;
    const r = reader(view, registry, plan, damage);

    // Prompts
    if (view.prompt) {
      const answers = of('answer');
      if (view.phase === 'setup') return done(setupAnswer(r, answers));
      return done(answerPrompt(view, legal, plan, registry, damage));
    }

    const you = view.you;
    const handCard = (uid: string): CardInstance | undefined => you.hand.find((c) => c.uid === uid);
    const handDef = (uid: string): CardDef | undefined => {
      const c = handCard(uid);
      return c ? r.def(c) : undefined;
    };
    const target = view.opponent.active ? r.top(view.opponent.active) : null;
    const slots: { ref: SlotRef; slot: SlotView }[] = [
      ...(you.active ? [{ ref: { player: view.me, zone: 'active' } as SlotRef, slot: you.active }] : []),
      ...you.bench.map((slot, index) => ({
        ref: { player: view.me, zone: 'bench', index } as SlotRef,
        slot,
      })),
    ];
    const slotFor = (ref: SlotRef) =>
      slots.find(
        (x) =>
          x.ref.zone === ref.zone &&
          (ref.zone === 'active' || (x.ref as { index: number }).index === (ref as { index: number }).index),
      )?.slot;
    const attackerScore = (ref: SlotRef): number => {
      const slot = slotFor(ref);
      if (!slot) return -Infinity;
      const need = r.need(slot);
      return (
        (need > 0 && need < Infinity ? 100 - need * 10 : 0) +
        (r.inLines(r.top(slot).name) ? 50 : 0) +
        (ref.zone === 'active' ? 5 : 0)
      );
    };
    const trainers = of('playTrainer')
      .map((a) => ({ a, d: handDef(a.uid) }))
      .filter(
        (
          x,
        ): x is {
          a: Extract<Action, { type: 'playTrainer' }>;
          d: Extract<CardDef, { category: 'Trainer' }>;
        } => x.d?.category === 'Trainer',
      );
    const role = (d: Extract<CardDef, { category: 'Trainer' }>) => trainerRole(d);
    const board = boardNames(r);

    // 1. Search Items and Basics that fill the plan.
    const searches = trainers.filter((x) => {
      if (role(x.d) !== 'search') return false;
      // Ultra Ball style costs: do not strip a tiny hand.
      if (/discard 2 other cards/i.test(x.d.text) && you.hand.length < 4) return false;
      if (/discard pile/i.test(x.d.text) && !/search your deck/i.test(x.d.text) && you.discard.length === 0)
        return false;
      return true;
    });
    if (searches.length) return done(searches[0]!.a);
    const needsBench = you.bench.length < MAX_BENCH;
    const basics = of('playBasic').filter((a) => {
      const d = handDef(a.uid);
      if (d?.category !== 'Pokemon') return false;
      if (you.bench.length === 0) return true;
      if (!d.isEx && !d.isMega) return true;
      return plan.priority.slice(0, 6).includes(d.name) || r.inLines(d.name) || plan.support.includes(d.name);
    });
    if (needsBench && basics.length) {
      const wanted = basics
        .map((a) => ({ a, w: wantScore(r, handCard(a.uid)!, [], board) }))
        .sort((x, y) => y.w - x.w);
      return done(wanted[0]!.a);
    }

    // 2. Evolutions and Rare Candy.
    const evolve = of('evolve');
    if (evolve.length) {
      const line = evolve.filter((a) => {
        const d = handDef(a.uid);
        return d?.category === 'Pokemon' && r.inLines(d.name);
      });
      return done(pick(line.length ? line : evolve));
    }
    const candy = trainers.filter((x) => role(x.d) === 'evolve');
    if (candy.length) return done(candy[0]!.a);

    // 3. Draw Supporters, only when nothing better is left to do or the hand is small.
    const attachable = of('attachEnergy');
    const otherPlays =
      trainers.some((x) => !['draw', 'switch', 'gust'].includes(role(x.d))) || attachable.length > 0;
    const draws = trainers.filter((x) => role(x.d) === 'draw');
    if (draws.length && (you.hand.length <= 3 || !otherPlays)) return done(draws[0]!.a);

    // 4. Gust only for a better Knock Out.
    const gusts = trainers.filter((x) => role(x.d) === 'gust');
    if (gusts.length && you.active) {
      const worth = worthGusting(r);
      if (worth) return done(gusts[0]!.a);
    }

    // 5. Abilities, Tools, Stadiums and other Trainers.
    const fresh = of('useAbility').filter(
      (a) => (r.slotAt(a.slot)?.abilityUses?.[a.ability]?.turn ?? -1) !== view.turn,
    );
    const abilities = [...fresh, ...of('useStadium')];
    if (abilities.length) return done(pick(abilities));
    const others = trainers.filter((x) => ['other'].includes(role(x.d)));
    if (others.length) {
      const x = others[0]!;
      const targeted = others.filter((y) => y.a.target);
      if (x.a.target && targeted.length) {
        const best = targeted.reduce((m, y) =>
          attackerScore(y.a.target!) > attackerScore(m.a.target!) ? y : m,
        );
        return done(best.a);
      }
      return done(x.a);
    }

    // 6. Energy to the Active if it can then attack, else to the planned next attacker.
    if (attachable.length) {
      const scored = attachable.map((a) => {
        const slot = slotFor(a.target);
        const card = handCard(a.uid);
        let score = attackerScore(a.target);
        if (slot && card) {
          const d = r.def(card);
          const gives = d.category === 'Energy' ? d.provides : [];
          const before = r.need(slot);
          const have = [...r.provides(slot), ...gives];
          const after = Math.min(...r.top(slot).attacks.map((atk) => missing(atk.cost, have)), Infinity);
          if (after < before) score += 20;
          if (a.target.zone === 'active' && after === 0) score += 40;
        }
        return { a, score };
      });
      scored.sort((x, y) => y.score - x.score);
      return done(scored[0]!.a);
    }

    // 7. Retreat when the Active cannot attack and a Benched Pokémon can.
    const retreats = of('retreat');
    if (retreats.length && you.active) {
      const now = r.bestNow(you.active, target);
      if (now === 0) {
        const ready = retreats
          .map((a) => ({ a, dmg: you.bench[a.benchIndex] ? r.bestNow(you.bench[a.benchIndex]!, target) : 0 }))
          .filter((x) => x.dmg > 0)
          .sort((x, y) => y.dmg - x.dmg);
        if (ready.length) return done(ready[0]!.a);
      }
    }

    // 8. Attack: one that Knocks Out, else the most estimated damage; then end the turn.
    const attacks = of('attack');
    if (attacks.length) {
      const scored = attacks.map((a) => {
        const slot = a.benchIndex === undefined ? you.active : you.bench[a.benchIndex];
        const dmg = slot ? r.attackDamage(slot, a.attackIndex, target) : 0;
        const left = view.opponent.active
          ? (view.opponent.active.hp ?? target?.hp ?? 0) - view.opponent.active.damage
          : Infinity;
        return { a, dmg, ko: dmg >= left };
      });
      const ko = scored.find((x) => x.ko);
      if (ko) return done(ko.a);
      scored.sort((x, y) => y.dmg - x.dmg);
      return done(scored[0]!.a);
    }
    const end = of('endTurn');
    if (end.length) return done(end[0]!);
    const other = legal.find((a) => a.type !== 'concede');
    if (!other) throw new Error('Bot has no move except concede');
    return done(other);
  };
}

/** Setup: the Active is a non-ex Basic from the plan if possible; the Bench gets up to 3 useful Basics. */
function setupAnswer(r: Reader, answers: Answer[]): Action {
  const prompt = r.view.prompt!;
  const hand = r.view.you.hand;
  const defOf = (o: PromptOption): CardDef | undefined => {
    const c = hand.find((x) => x.uid === o.uid);
    return c ? r.def(c) : undefined;
  };
  const done = answers.find((a) => a.optionId === 'done');
  const byId = new Map(answers.map((a) => [a.optionId, a]));
  const options = prompt.options.filter((o) => byId.has(o.id));
  const scoreOf = (o: PromptOption): number => {
    const d = defOf(o);
    if (d?.category !== 'Pokemon') return -1;
    return (
      (d.isEx || d.isMega ? 0 : 50) +
      (r.inLines(d.name) ? 20 : 0) +
      (r.plan.support.includes(d.name) ? 10 : 0) +
      d.hp / 100
    );
  };
  const ranked = [...options].sort((a, b) => scoreOf(b) - scoreOf(a));
  if (prompt.min === 1 && prompt.max === 1) return byId.get(ranked[0]!.id)!;
  // Bench: only cards worth it, at most 3.
  const best = ranked[0];
  if (done && (!best || prompt.selected.length >= 3 || scoreOf(best) < 20)) return done;
  return best ? byId.get(best.id)! : (done ?? answers[0]!);
}

/** Gust pays only if it lets the Active Knock Out something worth more than the Active's own target. */
function worthGusting(r: Reader): boolean {
  const { view } = r;
  const me = view.you.active;
  if (!me) return false;
  const reach = (d: PokemonDef) => r.bestNow(me, d);
  if (reach(r.top(me)) === 0 && r.bestNow(me, null) === 0) return false;
  const left = (slot: SlotView, d: PokemonDef) => (slot.hp ?? d.hp) - slot.damage;
  const act = view.opponent.active;
  const activeKo = act ? reach(r.top(act)) >= left(act, r.top(act)) : false;
  const activeValue = activeKo && act ? prizeOf(r.top(act)) : 0;
  let best = 0;
  for (const slot of view.opponent.bench) {
    const d = r.top(slot);
    if (reach(d) >= left(slot, d)) best = Math.max(best, prizeOf(d));
  }
  return best > activeValue;
}
