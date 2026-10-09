import type { CardScript } from '@ptcg/engine';

export const name = "Erika's Invitation";
export const set = 'sv03.5';
export const script: CardScript = {
  trainer: {
    canPlay: (ctx) => {
      const opp = ctx.state.players[ctx.opp];
      return (
        opp.bench.length < ctx.env.ruleset.benchSize &&
        opp.hand.some((uid) => {
          const d = ctx.def(uid);
          return d.category === 'Pokemon' && d.stage === 'Basic';
        })
      );
    },
    play(ctx) {
      const opp = ctx.state.players[ctx.opp];
      ctx.reveal(opp.hand);
      const basics = opp.hand.filter((uid) => {
        const d = ctx.def(uid);
        return d.category === 'Pokemon' && d.stage === 'Basic';
      });
      const [pick] = ctx.chooseCards({
        player: ctx.me,
        from: basics,
        min: 1,
        max: 1,
        message: "Choose a Basic Pokémon to put onto your opponent's Bench",
      });
      const ref = ctx.putOnBench(ctx.opp, pick!);
      if (ref.zone === 'bench') ctx.switchActive(ctx.opp, ref.index);
    },
  },
};
