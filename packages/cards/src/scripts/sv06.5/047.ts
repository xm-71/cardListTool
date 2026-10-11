import { dealAttackDamage, type CardScript } from '@ptcg/engine';
import { inPlayRefs } from '../util.ts';

export const name = 'Kyurem';
export const set = 'sv06.5';
export const script: CardScript = {
  // Plasma Bane: if your opponent has a "Colress" card in their discard pile, Trifrost costs {C}.
  modifyAttackCost(q) {
    if (q.attackIndex !== 0) return q.cost;
    const opp = q.holder.player === 0 ? 1 : 0;
    const colress = q.state.players[opp].discard.some((u) =>
      q.registry.defs[q.state.cards[u]!.defId]?.name.includes('Colress'),
    );
    return colress ? ['Colorless'] : q.cost;
  },
  attacks: {
    // Trifrost: discard all Energy from this Pokémon; 110 damage to 3 of your opponent's Pokémon.
    0: {
      damage: () => 0,
      effect(ctx) {
        const me = { player: ctx.me, zone: 'active' } as const;
        if (ctx.state.players[ctx.me].active) ctx.discardEnergy(me, [...ctx.slot(me).energy]);
        const among = inPlayRefs(ctx, ctx.opp);
        const picks = ctx.chooseSlot({
          player: ctx.me,
          among,
          min: Math.min(3, among.length),
          max: Math.min(3, among.length),
          message: "Choose 3 of your opponent's Pokémon",
        });
        for (const ref of picks)
          dealAttackDamage(ctx, ref, 110, { ignoreWeaknessResistance: ref.zone === 'bench' });
      },
    },
  },
};
