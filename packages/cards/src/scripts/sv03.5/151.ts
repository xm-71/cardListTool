import { useAttackAs, type CardScript } from '@ptcg/engine';
import { topDef } from '../util.ts';

const ABILITY = 'Restart';

export const name = 'Mew ex';
export const set = 'sv03.5';
export const script: CardScript = {
  abilities: {
    // Restart: once during your turn, draw cards until you have 3 cards in your hand.
    [ABILITY]: {
      canUse: (ctx) => !ctx.usedAbilityNameThisTurn(ABILITY) && ctx.state.players[ctx.me].hand.length < 3,
      use(ctx) {
        ctx.markAbilityName(ABILITY);
        ctx.draw(ctx.me, 3 - ctx.state.players[ctx.me].hand.length);
      },
    },
  },
  attacks: {
    // Genome Hacking: choose 1 of your opponent's Active Pokémon's attacks and use it as this attack.
    0: {
      canUse: (ctx) => ctx.state.players[ctx.opp].active != null,
      damage: () => 0,
      effect(ctx) {
        if (!ctx.state.players[ctx.opp].active) return;
        const d = topDef(ctx, { player: ctx.opp, zone: 'active' });
        if (d.attacks.length === 0) return;
        const pick =
          d.attacks.length === 1
            ? '0'
            : ctx.chooseOption({
                player: ctx.me,
                options: d.attacks.map((a, i) => ({ id: String(i), label: a.name })),
                message: `Use which of ${d.name}'s attacks?`,
              });
        useAttackAs(ctx, d.id, Number(pick));
      },
    },
  },
};
