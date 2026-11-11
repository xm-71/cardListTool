import { maxHp, type CardScript } from '@ptcg/engine';

export const name = 'Iron Hands ex';
export const set = 'sv04';
export const script: CardScript = {
  attacks: {
    // Amp You Very Much: if your opponent's Pokémon is Knocked Out by damage from this attack, take 1 more Prize card.
    // The engine has no per-attack Prize hook, so the extra Prize is taken here, when the damage is lethal (the usual
    // Prize cards follow with the Knock Out).
    1: {
      effect(ctx) {
        const ref = { player: ctx.opp, zone: 'active' } as const;
        const slot = ctx.state.players[ctx.opp].active;
        if (!slot || slot.damage < maxHp(ctx.env, ctx.state, ref)) return;
        const mine = ctx.state.players[ctx.me];
        const [prize] = mine.prizes.splice(0, 1);
        if (prize) {
          mine.hand.push(prize);
          ctx.log('Player takes 1 more Prize card');
        }
      },
    },
  },
};
