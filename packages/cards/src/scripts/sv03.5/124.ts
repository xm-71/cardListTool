import type { CardScript } from '@ptcg/engine';

export const name = 'Jynx ex';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Heart-Stopping Kiss: if the Defending Pokémon is Asleep, it is Knocked Out.
    0: {
      effect(ctx) {
        const slot = ctx.slot({ player: ctx.opp, zone: 'active' });
        if (slot.conditions.rotation !== 'asleep') return;
        ctx.log('Heart-Stopping Kiss Knocks the Defending Pokémon Out');
        ctx.knockOut({ player: ctx.opp, zone: 'active' });
      },
    },
    // Icy Wind
    1: { effect: (ctx) => ctx.applyCondition({ player: ctx.opp, zone: 'active' }, 'asleep') },
  },
};
