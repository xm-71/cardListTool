import type { CardScript } from '@ptcg/engine';
import { sameRef } from '../util.ts';

export const name = 'Raichu';
export const set = 'sv03.5';
export const script: CardScript = {
  // Electrical Grounding: when another of your Pokémon is Knocked Out by an attack, you may move a {L} Energy from it to this Pokémon.
  afterKnockout(ctx, { holder, knocked }) {
    if (sameRef(holder, knocked)) return;
    const from = ctx.slot(knocked);
    const options = from.energy.filter((uid) => {
      const d = ctx.def(uid);
      return d.category === 'Energy' && d.provides.includes('Lightning');
    });
    if (options.length === 0) return;
    const [pick] = ctx.chooseCards({
      player: holder.player,
      from: options,
      min: 0,
      max: 1,
      message: 'Move a {L} Energy to Raichu?',
    });
    if (!pick) return;
    from.energy.splice(from.energy.indexOf(pick), 1);
    ctx.slot(holder).energy.push(pick);
    ctx.log('A {L} Energy is moved to Raichu');
  },
  attacks: {
    // Thunder: this Pokémon also does 50 damage to itself.
    0: { effect: (ctx) => ctx.damageSelf(50) },
  },
};
