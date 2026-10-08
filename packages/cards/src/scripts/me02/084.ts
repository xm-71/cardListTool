import type { CardScript } from '@ptcg/engine';

export const name = 'Mega Lopunny ex';
export const script: CardScript = {
  attacks: {
    // Gale Thrust: 170 more if it moved from the Bench to the Active Spot this turn.
    0: {
      damage: (ctx) =>
        ctx.slot({ player: ctx.me, zone: 'active' }).becameActiveTurn === ctx.state.turn ? 230 : 60,
    },
    // Spiky Hopper: not affected by any effects on the opponent's Active Pokémon.
    1: { damage: () => ({ amount: 160, ignoreWR: false, ignoreDefenderEffects: true }) },
  },
};
