import type { CardScript } from '@ptcg/engine';
import { benchRefs, isBasicEnergy } from '../util.ts';

const ABILITY = 'Squawk and Seize';

export const name = 'Squawkabilly ex';
export const script: CardScript = {
  abilities: {
    // Squawk and Seize: once during your first turn, discard your hand and draw 6 cards.
    [ABILITY]: {
      canUse: (ctx) =>
        ctx.state.turn === (ctx.me === ctx.state.first ? 1 : 2) && !ctx.usedAbilityNameThisTurn(ABILITY),
      use(ctx) {
        ctx.markAbilityName(ABILITY);
        for (const uid of [...ctx.state.players[ctx.me].hand])
          ctx.moveCard(uid, { player: ctx.me, zone: 'discard' });
        ctx.draw(ctx.me, 6);
      },
    },
  },
  attacks: {
    // Motivate: attach up to 2 Basic Energy from your discard pile to 1 of your Benched Pokémon.
    0: {
      effect(ctx) {
        const bench = benchRefs(ctx, ctx.me);
        const energy = ctx.state.players[ctx.me].discard.filter((u) => isBasicEnergy(ctx.def(u)));
        if (bench.length === 0 || energy.length === 0) return;
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: bench,
          min: 1,
          max: 1,
          message: 'Attach Energy to which Benched Pokémon?',
        });
        const picks = ctx.chooseCards({
          player: ctx.me,
          from: energy,
          min: 0,
          max: 2,
          message: 'Choose up to 2 Basic Energy from your discard pile',
        });
        for (const uid of picks) ctx.attachEnergy(uid, ref!);
      },
    },
  },
};
