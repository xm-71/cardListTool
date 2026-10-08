import {
  nextRandom,
  type Action,
  type CardDef,
  type CardInstance,
  type CardRegistry,
  type EnergyType,
  type PlayerView,
  type PokemonDef,
  type SlotRef,
  type SlotView,
} from '@ptcg/engine';
import type { Bot } from './types.ts';

/**
 * Easy bot: develops the board (evolve, Trainers, Energy, Basics, Abilities), then attacks,
 * preferring an attack that Knocks Out; otherwise the most base damage. Never retreats or concedes.
 */
export function createEasyBot(registry: CardRegistry): Bot {
  const def = (c: CardInstance): CardDef => registry.defs[c.defId]!;
  const top = (slot: SlotView): PokemonDef => def(slot.stack[slot.stack.length - 1]!) as PokemonDef;
  const slotAt = (view: PlayerView, ref: SlotRef): SlotView | null => {
    const side = ref.player === view.me ? view.you : view.opponent;
    return ref.zone === 'active' ? side.active : (side.bench[ref.index] ?? null);
  };
  const provides = (slot: SlotView): EnergyType[] =>
    slot.energy.flatMap((c) => {
      const d = def(c);
      return d.category === 'Energy' ? d.provides : [];
    });
  /** Energy still missing to pay `cost` from the attached Energy (typed first, then Colorless). */
  const missing = (cost: EnergyType[], have: EnergyType[]): number => {
    const pool = [...have];
    let short = 0;
    for (const t of cost.filter((c) => c !== 'Colorless')) {
      const i = pool.indexOf(t);
      if (i >= 0) pool.splice(i, 1);
      else short++;
    }
    return short + Math.max(0, cost.filter((c) => c === 'Colorless').length - pool.length);
  };
  const estimate = (view: PlayerView, attackIndex: number): { damage: number; kos: boolean } => {
    const me = view.you.active;
    const them = view.opponent.active;
    if (!me || !them) return { damage: 0, kos: false };
    const attacker = top(me);
    const defender = top(them);
    let damage = attacker.attacks[attackIndex]?.damage ?? 0;
    if (defender.weakness && attacker.types.includes(defender.weakness)) damage *= 2;
    if (defender.resistance && attacker.types.includes(defender.resistance)) damage -= 30;
    return { damage, kos: damage >= defender.hp - them.damage };
  };

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

    // 1. Prompts
    const answers = of('answer');
    if (answers.length) {
      const prompt = view.prompt;
      const options = answers.filter((a) => a.optionId !== 'done');
      if (prompt && options.length) {
        if (view.phase === 'setup' && prompt.min === 1 && prompt.max === 1) {
          // Active Pokémon: highest HP
          const best = [...prompt.options].sort((a, b) => hpOf(b.uid) - hpOf(a.uid))[0]!;
          return done({ type: 'answer', optionId: best.id });
        }
        if (prompt.kind === 'slot' && prompt.message.startsWith('Choose a new Active')) {
          const best = [...prompt.options].sort((a, b) => energyAt(b.slot) - energyAt(a.slot))[0]!;
          return done({ type: 'answer', optionId: best.id });
        }
        const yes = options.find((a) => a.optionId === 'yes');
        return done(yes ?? pick(options));
      }
      return done(answers[0]!);
    }

    // 2. Evolve
    const evolve = of('evolve');
    if (evolve.length) return done(pick(evolve));
    // 3. Trainers (Items, Supporters, Stadiums, Tools)
    const trainers = of('playTrainer');
    if (trainers.length) return done(pick(trainers));
    // 4. Energy: to the Active until it can pay its best attack, else to the Benched Pokémon closest to one
    const attach = of('attachEnergy');
    if (attach.length) {
      const need = (ref: SlotRef) => {
        const slot = slotAt(view, ref);
        if (!slot) return Infinity;
        const atks = top(slot).attacks;
        if (!atks.length) return Infinity;
        return Math.min(...atks.map((a) => missing(a.cost, provides(slot))));
      };
      const activeAttach = attach.find((a) => a.target.zone === 'active' && need(a.target) > 0);
      if (activeAttach) return done(activeAttach);
      const bench = attach
        .filter((a) => a.target.zone === 'bench' && need(a.target) > 0 && need(a.target) !== Infinity)
        .sort((a, b) => need(a.target) - need(b.target));
      if (bench.length) return done(bench[0]!);
      return done(pick(attach));
    }
    // 5. Basics
    const basics = of('playBasic');
    if (basics.length) return done(pick(basics));
    // 6. Abilities and Stadium effects
    // A repeatable ("as often as you like") Ability is used once a turn: spamming it just shuffles cards around.
    const fresh = of('useAbility').filter(
      (a) => (slotAt(view, a.slot)?.abilityUses?.[a.ability]?.turn ?? -1) !== view.turn,
    );
    const abilities = [...fresh, ...of('useStadium')];
    if (abilities.length) return done(pick(abilities));
    // 7. Attack: one that Knocks Out, else the most base damage
    const attacks = of('attack');
    if (attacks.length) {
      const scored = attacks.map((a) => ({ a, ...estimate(view, a.attackIndex) }));
      const ko = scored.find((x) => x.kos);
      if (ko) return done(ko.a);
      scored.sort((x, y) => y.damage - x.damage);
      return done(scored[0]!.a);
    }
    // 8. End the turn
    const end = of('endTurn');
    if (end.length) return done(end[0]!);
    const other = legal.find((a) => a.type !== 'concede');
    // Only concede is left: the engine stalled. Fail loudly instead of quietly giving up the game.
    if (!other) throw new Error('Bot has no move except concede');
    return done(other);

    function hpOf(uid: string | undefined): number {
      if (!uid) return 0;
      const card = view.you.hand.find((c) => c.uid === uid);
      const d = card ? def(card) : null;
      return d?.category === 'Pokemon' ? d.hp : 0;
    }
    function energyAt(ref: SlotRef | undefined): number {
      const slot = ref ? slotAt(view, ref) : null;
      return slot ? slot.energy.length : -1;
    }
  };
}
