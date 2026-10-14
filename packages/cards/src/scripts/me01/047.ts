import type { CardScript } from '@ptcg/engine';

export const name = 'Magnezone';
export const script: CardScript = {
  attacks: {
    // Upper Spark: if this Pokémon evolved from Magneton during this turn, this attack does 120 more damage.
    0: {
      damage(ctx) {
        const slot = ctx.slot({ player: ctx.me, zone: 'active' });
        const previous = slot.stack[slot.stack.length - 2];
        const fromMagneton =
          slot.evolvedTurn === ctx.state.turn && previous && ctx.def(previous).name === 'Magneton';
        return fromMagneton ? 170 : 50;
      },
    },
    // Flashing Bolt: during your next turn, this Pokémon can't use Flashing Bolt.
    1: { effect: (ctx) => ctx.lockAttack({ player: ctx.me, zone: 'active' }, 'Flashing Bolt') },
  },
};
