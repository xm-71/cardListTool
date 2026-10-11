import { useAttackAs, type CardScript, type EffectCtx } from '@ptcg/engine';
import { benchRefs, topDef } from '../util.ts';

/** Your Benched N's Pokémon, by their top card's definition id. */
const nsBench = (ctx: EffectCtx) =>
  benchRefs(ctx, ctx.me)
    .map((r) => topDef(ctx, r))
    // Another N's Zoroark ex's Night Joker would only ask again, so it isn't offered.
    .filter((d) => d.name.startsWith("N's ") && d.name !== "N's Zoroark ex" && d.attacks.length > 0);

export const name = "N's Zoroark ex";
export const set = 'sv09';
export const script: CardScript = {
  abilities: {
    // Trade: discard a card from your hand to draw 2 cards.
    Trade: {
      canUse: (ctx) => ctx.state.players[ctx.me].hand.length > 0,
      use(ctx) {
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from: [...ctx.state.players[ctx.me].hand],
          min: 1,
          max: 1,
          message: 'Discard a card',
        });
        ctx.moveCard(uid!, { player: ctx.me, zone: 'discard' });
        ctx.draw(ctx.me, 2);
      },
    },
  },
  attacks: {
    // Night Joker: choose 1 of your Benched N's Pokémon's attacks and use it as this attack.
    0: {
      canUse: (ctx) => nsBench(ctx).length > 0,
      damage: () => 0,
      effect(ctx) {
        const choices = nsBench(ctx).flatMap((d) =>
          d.attacks.map((a, i) => ({ id: `${d.id}|${i}`, label: `${d.name}: ${a.name}` })),
        );
        if (choices.length === 0) return;
        const pick = ctx.chooseOption({ player: ctx.me, options: choices, message: 'Use which attack?' });
        const [defId, i] = pick.split('|');
        useAttackAs(ctx, defId!, Number(i));
      },
    },
  },
};
