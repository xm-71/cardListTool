import type { CardScript } from '@ptcg/engine';

export const name = "Giovanni's Charisma";
export const set = 'sv03.5';
export const script: CardScript = {
  trainer: {
    // Put an Energy attached to the opponent's Active Pokémon into their hand; if you did, attach an Energy from your hand to your Active Pokémon.
    play(ctx) {
      const theirs = { player: ctx.opp, zone: 'active' } as const;
      const energy = ctx.slot(theirs).energy;
      if (energy.length === 0) return;
      const [pick] = ctx.chooseCards({
        player: ctx.me,
        from: [...energy],
        min: 1,
        max: 1,
        message: "Choose an Energy attached to your opponent's Active Pokémon",
      });
      ctx.detachEnergy(theirs, [pick!], 'hand');
      const hand = ctx.state.players[ctx.me].hand.filter((uid) => ctx.def(uid).category === 'Energy');
      if (hand.length === 0) return;
      const [mine] = ctx.chooseCards({
        player: ctx.me,
        from: hand,
        min: 1,
        max: 1,
        message: 'Choose an Energy card to attach to your Active Pokémon',
      });
      ctx.attachEnergy(mine!, { player: ctx.me, zone: 'active' });
    },
  },
};
