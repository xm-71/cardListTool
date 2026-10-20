import { useAttackAs, type CardScript } from '@ptcg/engine';
import { topDef } from '../util.ts';

/** Attacks that could be copied: not another Genome Hacking, which would only ask again. */
const copyable = (d: { attacks: { name: string }[] }) =>
  d.attacks.map((a, i) => ({ a, i })).filter(({ a }) => a.name !== 'Genome Hacking');

export const name = 'Mew ex';
export const set = 'sv03.5';
export const script: CardScript = {
  abilities: {
    // Restart: once during your turn, draw cards until you have 3 cards in your hand.
    Restart: {
      canUse: (ctx) => ctx.state.players[ctx.me].hand.length < 3,
      use(ctx) {
        ctx.draw(ctx.me, 3 - ctx.state.players[ctx.me].hand.length);
      },
    },
  },
  attacks: {
    // Genome Hacking: choose 1 of your opponent's Active Pokémon's attacks and use it as this attack.
    0: {
      canUse: (ctx) => {
        const opp = ctx.state.players[ctx.opp].active;
        return opp != null && copyable(topDef(ctx, { player: ctx.opp, zone: 'active' })).length > 0;
      },
      damage: () => 0,
      effect(ctx) {
        if (!ctx.state.players[ctx.opp].active) return;
        const d = topDef(ctx, { player: ctx.opp, zone: 'active' });
        const options = copyable(d);
        if (options.length === 0) return;
        const pick =
          options.length === 1
            ? String(options[0]!.i)
            : ctx.chooseOption({
                player: ctx.me,
                options: options.map(({ a, i }) => ({ id: String(i), label: a.name })),
                message: `Use which of ${d.name}'s attacks?`,
              });
        useAttackAs(ctx, d.id, Number(pick));
      },
    },
  },
};
