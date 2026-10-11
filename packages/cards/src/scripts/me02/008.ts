import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { energyOfType, inPlayRefs } from '../util.ts';

export const name = 'Genesect';
export const set = 'me02';
export const script: CardScript = {
  attacks: {
    // Bug's Cannon: 20 damage to 1 of your opponent's Pokémon for each {G} Energy on this Pokémon.
    0: {
      effect(ctx) {
        const n = energyOfType(ctx, { player: ctx.me, zone: 'active' }, 'Grass').length;
        if (n === 0) return;
        const [ref] = ctx.chooseSlot({
          player: ctx.me,
          among: inPlayRefs(ctx, ctx.opp),
          min: 1,
          max: 1,
          message: "Choose 1 of your opponent's Pokémon",
        });
        dealAttackDamage(ctx, ref!, 20 * n, { ignoreWeaknessResistance: ref!.zone === 'bench' });
      },
    },
  },
};
