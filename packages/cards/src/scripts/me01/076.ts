import type { CardScript } from '@ptcg/engine';

export const name = 'Riolu';
export const script: CardScript = {
  attacks: {
    // Accelerating Stab
    0: { effect: (ctx) => ctx.lockAttack({ player: ctx.me, zone: 'active' }, 'Accelerating Stab') },
  },
};
