import type { CardScript } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy, searchDeck } from '../util.ts';

export const name = 'Chien-Pao ex';
export const script: CardScript = {
  abilities: {
    // Shivery Chill: once during your turn, if this Pokémon is Active, search for up to 2 Basic {W} Energy.
    'Shivery Chill': {
      canUse: (ctx) => ctx.source?.kind === 'ability' && ctx.source.slot.zone === 'active',
      use(ctx) {
        const picks = searchDeck(ctx, {
          filter: (d) => isBasicEnergy(d, 'Water'),
          max: 2,
          message: 'Choose up to 2 Basic {W} Energy',
        });
        if (picks.length > 0) {
          ctx.reveal(picks);
          for (const uid of picks) ctx.moveCard(uid, { player: ctx.me, zone: 'hand' });
        }
        ctx.shuffleDeck(ctx.me);
      },
    },
  },
  attacks: {
    // Hail Blade: discard any amount of {W} Energy from your Pokémon; 60 damage for each.
    0: {
      damage(ctx) {
        const options = inPlayRefs(ctx, ctx.me).flatMap((ref) =>
          ctx
            .slot(ref)
            .energy.filter((u) => {
              const d = ctx.def(u);
              return d.category === 'Energy' && d.provides.includes('Water');
            })
            .map((uid) => ({ ref, uid })),
        );
        if (options.length === 0) return 0;
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: options.map((o) => o.uid),
          min: 0,
          max: options.length,
          message: 'Discard any amount of {W} Energy from your Pokémon (60 damage each)',
        });
        for (const uid of picks) ctx.discardEnergy(options.find((o) => o.uid === uid)!.ref, [uid]);
        return 60 * picks.length;
      },
    },
  },
};
