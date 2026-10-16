import type {
  CardRegistry,
  Engine,
  EnergyType,
  GameState,
  PlayerId,
  PokemonDef,
  PokemonSlot,
  SlotRef,
} from '@ptcg/engine';
import { createEngine } from '@ptcg/engine';

const TARGET = 'sandbox-target';

/**
 * Raw damage (before Weakness and Resistance) by card, attack, attached Energy count and a `variant`. The variant
 * is empty for an attack with a fixed damage; for a scripted one it describes what the script may read (see
 * `damageVariant`), so a value worked out in one position is not reused in another.
 */
export class DamageCache {
  private readonly values = new Map<string, number>();
  private static key(defId: string, attackIndex: number, energy: number, variant: string): string {
    return `${defId}|${attackIndex}|${energy}|${variant}`;
  }
  get(defId: string, attackIndex: number, energy: number, variant = ''): number | undefined {
    return this.values.get(DamageCache.key(defId, attackIndex, energy, variant));
  }
  set(defId: string, attackIndex: number, energy: number, damage: number, variant = ''): void {
    this.values.set(DamageCache.key(defId, attackIndex, energy, variant), damage);
  }
}

/** What a scripted damage most often depends on: the attacker's own damage, both Prize counts and its Energy types. */
export function damageVariant(
  scripted: boolean,
  damageOnAttacker: number,
  myPrizes: number,
  oppPrizes: number,
  energyTypes: string[],
): string {
  return scripted ? `${damageOnAttacker}/${myPrizes}/${oppPrizes}/${[...energyTypes].sort().join(',')}` : '';
}

/** The attack cannot be played out in the sandbox right now (not payable, not available): nothing to remember. */
class Unavailable extends Error {}

/** One engine per registry whose card list also holds a 9999-HP target with no Weakness or Resistance. */
const sandboxes = new WeakMap<CardRegistry, Engine>();
function sandboxEngine(engine: Engine): Engine {
  let sb = sandboxes.get(engine.registry);
  if (!sb) {
    const target: PokemonDef = {
      id: TARGET,
      name: 'Sandbox target',
      regulationMark: 'I',
      rarity: 'Common',
      image: '',
      category: 'Pokemon',
      stage: 'Basic',
      hp: 9999,
      types: ['Colorless'],
      evolvesFrom: null,
      weakness: null,
      resistance: null,
      retreat: 0,
      attacks: [],
      abilities: [],
      isEx: false,
      isMega: false,
    };
    sb = createEngine({
      defs: { ...engine.registry.defs, [TARGET]: target },
      scripts: engine.registry.scripts,
    });
    sandboxes.set(engine.registry, sb);
  }
  return sb;
}

const clearTrouble = (slot: PokemonSlot): void => {
  slot.conditions = { rotation: 'none', poisoned: false, burned: false };
  slot.cantAttackOnTurn = null;
  slot.attackLocks = {};
  slot.markers = [];
};

/**
 * The damage the attack would deal to a plain target (before Weakness and Resistance), found by playing it in a
 * throwaway copy of the game. `extraEnergy` more Energy are attached first. Cached per card, attack and Energy
 * count; the printed damage stands in when the attack cannot be played out (it asks a question, is not payable, …).
 */
export function estimateDamage(
  engine: Engine,
  state: GameState,
  attacker: SlotRef,
  attackIndex: number,
  cache: DamageCache,
  extraEnergy = 0,
): number {
  const side = state.players[attacker.player];
  const slot = attacker.zone === 'active' ? side.active : side.bench[attacker.index];
  if (!slot) return 0;
  const defId = state.cards[slot.stack[slot.stack.length - 1]!]!.defId;
  const def = engine.registry.defs[defId] as PokemonDef;
  const printed = def.attacks[attackIndex]?.damage ?? 0;
  const energy = slot.energy.length + extraEnergy;
  const scripted = !!engine.registry.scripts[defId]?.attacks?.[attackIndex]?.damage;
  const types = slot.energy.flatMap((uid) => {
    const d = engine.registry.defs[state.cards[uid]!.defId];
    return d?.category === 'Energy' ? d.provides : [];
  });
  const other = state.players[attacker.player === 0 ? 1 : 0];
  const variant = damageVariant(scripted, slot.damage, side.prizes.length, other.prizes.length, types);
  const known = cache.get(defId, attackIndex, energy, variant);
  if (known !== undefined) return known;
  let damage: number;
  try {
    damage = playOut(engine, state, attacker, attackIndex, def, extraEnergy);
  } catch (e) {
    // Not payable or not available right now: the printed damage is only a stand-in, so it is not remembered.
    if (e instanceof Unavailable) return printed;
    damage = printed;
  }
  cache.set(defId, attackIndex, energy, damage, variant);
  return damage;
}

function playOut(
  engine: Engine,
  state: GameState,
  attacker: SlotRef,
  attackIndex: number,
  def: PokemonDef,
  extraEnergy: number,
): number {
  const sb = sandboxEngine(engine);
  const s = structuredClone(state);
  const me = attacker.player;
  const opp: PlayerId = me === 0 ? 1 : 0;
  s.prompt = null;
  s.pending = null;
  s.result = null;
  s.phase = 'main';
  s.current = me;
  // The first player cannot attack on turn 1; move to the next turn that belongs to `me`.
  while (s.turn < 2 || (s.turn % 2 === 1) !== (me === s.first)) s.turn++;

  const p = s.players[me];
  if (attacker.zone === 'bench') {
    const benched = p.bench[attacker.index]!;
    p.bench[attacker.index] = p.active!;
    p.active = benched;
  }
  const slot = p.active!;
  clearTrouble(slot);

  const missing = (def.attacks[attackIndex]?.cost ?? []).find((t) => t !== 'Colorless') as
    EnergyType | undefined;
  for (let i = 0; i < extraEnergy; i++) {
    const energyDef = Object.values(engine.registry.defs).find(
      (d) =>
        d.category === 'Energy' && d.energyKind === 'Basic' && (!missing || d.provides.includes(missing)),
    );
    if (!energyDef) throw new Unavailable('no Basic Energy to attach');
    const uid = `sandbox-energy-${i}`;
    s.cards[uid] = { uid, defId: energyDef.id, owner: me };
    slot.energy.push(uid);
  }

  const target = s.players[opp].active;
  if (!target) throw new Unavailable('nothing to attack');
  const topUid = target.stack[target.stack.length - 1]!;
  s.cards[topUid]!.defId = TARGET;
  target.stack = [topUid];
  target.damage = 0;
  target.energy = [];
  target.tool = null;
  clearTrouble(target);

  if (!sb.getLegalActions(s, me).some((a) => a.type === 'attack' && a.attackIndex === attackIndex)) {
    throw new Unavailable('attack not available');
  }
  const after = sb.applyAction(s, me, { type: 'attack', attackIndex }).state;
  if (after.prompt) throw new Error('attack asks a question');
  return after.players[opp].active?.damage ?? 0;
}
