import { maxHp, type CardScript } from '@ptcg/engine';

export const name = 'Roaring Moon ex';
export const set = 'sv04';
export const script: CardScript = {
  attacks: {
    // Frenzied Gouging: Knock Out your opponent's Active Pokémon. If it is Knocked Out in this way, this Pokémon does
    // 200 damage to itself.
    0: {
      effect(ctx) {
        const ref = { player: ctx.opp, zone: 'active' } as const;
        const slot = ctx.state.players[ctx.opp].active;
        if (!slot) return;
        ctx.knockOut(ref);
        if (slot.damage >= maxHp(ctx.env, ctx.state, ref)) ctx.damageSelf(200);
      },
    },
    // Calamity Storm: you may discard a Stadium in play. If you do, this attack does 120 more damage.
    1: {
      damage(ctx) {
        if (!ctx.state.stadium) return 100;
        const pick = ctx.chooseOption({
          player: ctx.me,
          options: [
            { id: 'yes', label: 'Discard the Stadium in play for 120 more damage' },
            { id: 'no', label: 'Keep it' },
          ],
          message: 'Calamity Storm: discard the Stadium in play?',
        });
        if (pick !== 'yes') return 100;
        ctx.discardStadium();
        return 220;
      },
    },
  },
};
