import type { CardDef, CardRegistry } from '@ptcg/engine';

/** Whether the engine can run this card correctly (spec §4.2). */
export function isPlayable(def: CardDef, registry: CardRegistry): boolean {
  const script = registry.scripts[def.id];
  // Passive and triggered Abilities are written as hooks (modifyPrizes, onEvolveFromHand, …), not keyed by name.
  const hasPassiveHook =
    script !== undefined && Object.keys(script).some((k) => k !== 'attacks' && k !== 'abilities');
  switch (def.category) {
    case 'Pokemon':
      return (
        def.attacks.every((a, i) => a.text.trim() === '' || script?.attacks?.[i] !== undefined) &&
        def.abilities.every((a) => script?.abilities?.[a.name] !== undefined || hasPassiveHook)
      );
    case 'Trainer':
      return script !== undefined;
    case 'Energy':
      return def.energyKind === 'Basic' || script !== undefined;
  }
}
