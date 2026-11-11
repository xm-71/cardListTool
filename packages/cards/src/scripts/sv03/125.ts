import type { CardScript } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy, searchDeck } from '../util.ts';

export const name = 'Charizard ex';
export const set = 'sv03';
export const script: CardScript = {
  // Infernal Reign: when you play this Pokémon from your hand to evolve 1 of your Pokémon during your turn, you may
  // search your deck for up to 3 Basic {R} Energy cards and attach them to your Pokémon in any way you like.
  onEvolveFromHand: {
    use(ctx) {
      const picks = searchDeck(ctx, {
        filter: (d) => isBasicEnergy(d, 'Fire'),
        max: 3,
        message: 'Choose up to 3 Basic {R} Energy cards to attach',
      });
      for (const uid of picks) {
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.me),
          min: 1,
          max: 1,
          message: 'Attach it to which Pokémon?',
        });
        if (ref) ctx.attachEnergy(uid, ref);
      }
      ctx.shuffleDeck(ctx.me);
    },
  },
  attacks: {
    // Burning Darkness: 30 more damage for each Prize card your opponent has taken.
    0: {
      damage(ctx) {
        const taken = ctx.env.ruleset.prizeCount - ctx.state.players[ctx.opp].prizes.length;
        return 180 + 30 * taken;
      },
    },
  },
};
