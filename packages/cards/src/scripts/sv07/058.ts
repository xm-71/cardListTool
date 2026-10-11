import { useAttackAs, type CardScript } from '@ptcg/engine';

export const name = 'Slowking';
export const set = 'sv07';
export const script: CardScript = {
  attacks: {
    // Seek Inspiration: discard the top card of your deck; if it's a Pokémon without a Rule Box, use 1 of its attacks.
    0: {
      damage: () => 0,
      effect(ctx) {
        const [top] = ctx.state.players[ctx.me].deck;
        if (!top) return;
        ctx.moveCard(top, { player: ctx.me, zone: 'discard' });
        const d = ctx.def(top);
        ctx.log(`Seek Inspiration discards ${d.name}`);
        if (d.category !== 'Pokemon' || d.isEx || d.attacks.length === 0) return;
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
