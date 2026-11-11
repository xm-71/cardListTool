import type { CardScript, EffectCtx } from '@ptcg/engine';
import { abilityHolder, inPlayRefs, isBasicEnergy } from '../util.ts';

const waterInHand = (ctx: EffectCtx) =>
  ctx.state.players[ctx.me].hand.filter((u) => isBasicEnergy(ctx.def(u), 'Water'));

export const name = 'Mega Greninja ex';
export const script: CardScript = {
  abilities: {
    // Mortal Shuriken: once during your turn, if this Pokémon is in the Active Spot, you may discard a Basic {W} Energy
    // card from your hand in order to use this Ability. Place 6 damage counters on 1 of your opponent's Pokémon.
    'Mortal Shuriken': {
      canUse: (ctx) => abilityHolder(ctx).zone === 'active' && waterInHand(ctx).length > 0,
      use(ctx) {
        const [energy] = ctx.chooseCards({
          player: ctx.me,
          from: waterInHand(ctx),
          min: 1,
          max: 1,
          message: 'Discard a Basic {W} Energy card from your hand',
        });
        if (energy) ctx.moveCard(energy, { player: ctx.me, zone: 'discard' });
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.opp),
          min: 1,
          max: 1,
          message: "Place 6 damage counters on 1 of your opponent's Pokémon",
        });
        if (ref) ctx.placeCounters(ref, 6);
      },
    },
  },
  attacks: {
    // Ninja Spinner: you may put a {W} Energy attached to this Pokémon into your hand; 80 more damage if you do.
    0: {
      damage(ctx) {
        const attached = ctx
          .slot({ player: ctx.me, zone: 'active' })
          .energy.filter((u) => {
            const d = ctx.def(u);
            return d.category === 'Energy' && d.provides.includes('Water');
          });
        if (attached.length === 0) return 120;
        const pick = ctx.chooseOption({
          player: ctx.me,
          options: [
            { id: 'yes', label: 'Put a {W} Energy into your hand for 80 more damage' },
            { id: 'no', label: 'Keep the Energy' },
          ],
          message: 'Ninja Spinner: put a {W} Energy attached to this Pokémon into your hand?',
        });
        if (pick !== 'yes') return 120;
        const [uid] = ctx.chooseCards({
          player: ctx.me,
          from: attached,
          min: 1,
          max: 1,
          message: 'Choose a {W} Energy to put into your hand',
        });
        if (uid) ctx.detachEnergy({ player: ctx.me, zone: 'active' }, [uid], 'hand');
        return 200;
      },
    },
  },
};
