import type { CardScript } from '@ptcg/engine';
import { benchRefs } from '../util.ts';

export const name = 'Gengar';
export const set = 'sv03.5';
export const script: CardScript = {
  attacks: {
    // Poltergeist: reveal your opponent's hand; 50 damage for each Trainer card there.
    0: {
      damage(ctx) {
        const hand = ctx.state.players[ctx.opp].hand;
        ctx.reveal(hand);
        return 50 * hand.filter((uid) => ctx.def(uid).category === 'Trainer').length;
      },
    },
    // Hollow Dive: put 3 damage counters on your opponent's Benched Pokémon in any way you like.
    1: {
      effect(ctx) {
        for (let i = 0; i < 3; i++) {
          const among = benchRefs(ctx, ctx.opp);
          if (among.length === 0) return;
          const [ref] = ctx.chooseSlot({
            player: ctx.me,
            among,
            min: 1,
            max: 1,
            message: `Put a damage counter on which Benched Pokémon? (${3 - i} left)`,
          });
          ctx.placeCounters(ref!, 1);
        }
      },
    },
  },
};
