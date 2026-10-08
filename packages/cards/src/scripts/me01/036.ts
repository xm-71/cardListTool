import type { CardScript } from '@ptcg/engine';
import { isBasicEnergy } from '../util.ts';

export const name = 'Mega Abomasnow ex';
export const script: CardScript = {
  attacks: {
    // Hammer-lanche: discard the top 6 cards of your deck; 100 for each Basic {W} Energy among them.
    0: {
      damage(ctx) {
        const p = ctx.state.players[ctx.me];
        const milled = p.deck.splice(0, 6);
        p.discard.push(...milled);
        ctx.log(`${milled.length} cards are discarded from the top of the deck`);
        return 100 * milled.filter((u) => isBasicEnergy(ctx.def(u), 'Water')).length;
      },
    },
    // Frost Barrier
    1: { effect: (ctx) => ctx.addMarker({ player: ctx.me, zone: 'active' }, 'reduceIncoming', 30) },
  },
};
