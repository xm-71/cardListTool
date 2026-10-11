import type { Action, SlotRef } from '@ptcg/engine';
import { actionsForCard } from './actions.ts';
import { sameRef } from './view.ts';

/** Where a hand card can go: a Pokémon in play, or `'bench'` (the next empty Bench space). */
export interface Target {
  target: SlotRef | 'bench';
  /** What tapping the spot does; more than one means the player picks. */
  actions: Action[];
}

/** The spots a hand card can be played onto, each with the actions that put it there. */
export function targetsFor(legal: Action[], uid: string): Target[] {
  const out: Target[] = [];
  const add = (target: Target['target'], action: Action) => {
    const same = out.find((t) =>
      target === 'bench' || t.target === 'bench' ? t.target === target : sameRef(t.target, target),
    );
    if (same) same.actions.push(action);
    else out.push({ target, actions: [action] });
  };
  for (const a of actionsForCard(legal, uid)) {
    if (a.type === 'playBasic') add('bench', a);
    else if (a.type === 'evolve' || a.type === 'attachEnergy') add(a.target, a);
    else if (a.type === 'playTrainer' && a.target) add(a.target, a);
  }
  return out;
}

/** Actions that play a hand card without picking a spot: Trainers with no target, and Basic Pokémon. */
export function untargeted(legal: Action[], uid: string): Action[] {
  return actionsForCard(legal, uid).filter(
    (a) => a.type === 'playBasic' || (a.type === 'playTrainer' && !a.target),
  );
}
