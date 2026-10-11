import type { CardScript } from '@ptcg/engine';
import { inPlayRefs, isBasicEnergy } from '../util.ts';

export const name = 'Crispin';
export const script: CardScript = {
  // Search for up to 2 Basic Energy of different types: 1 to your hand, the other attached to 1 of your Pokémon.
  trainer: {
    play(ctx) {
      const deck = ctx.state.players[ctx.me].deck;
      const [first] = ctx.chooseCards({
        player: ctx.me,
        from: deck.filter((u) => isBasicEnergy(ctx.def(u))),
        min: 0,
        max: 1,
        message: 'Choose a Basic Energy',
      });
      const picked: string[] = [];
      if (first) {
        picked.push(first);
        const type = (ctx.def(first) as { provides: string[] }).provides[0];
        const [second] = ctx.chooseCards({
          player: ctx.me,
          from: deck.filter(
            (u) =>
              u !== first &&
              isBasicEnergy(ctx.def(u)) &&
              (ctx.def(u) as { provides: string[] }).provides[0] !== type,
          ),
          min: 0,
          max: 1,
          message: 'Choose a Basic Energy of a different type',
        });
        if (second) picked.push(second);
      }
      if (picked.length > 0) ctx.reveal(picked);
      if (picked.length === 2) {
        const [toHand] = ctx.chooseCards({
          player: ctx.me,
          from: picked,
          min: 1,
          max: 1,
          message: 'Choose the Energy to put into your hand',
        });
        ctx.moveCard(toHand!, { player: ctx.me, zone: 'hand' });
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.me),
          min: 1,
          max: 1,
          message: 'Attach the other Energy to which Pokémon?',
        });
        ctx.attachEnergy(
          picked.find((u) => u !== toHand)!,
          ref!,
        );
      } else if (picked.length === 1) ctx.moveCard(picked[0]!, { player: ctx.me, zone: 'hand' });
      ctx.shuffleDeck(ctx.me);
    },
  },
};
