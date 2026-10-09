import type { CardScript } from '@ptcg/engine';
import { inPlayRefs, sameRef, slotAt } from '../util.ts';

export const name = 'Mr. Mime';
export const set = 'sv03.5';
export const script: CardScript = {
  // Mimic Barrier: while this Pokémon and the opponent's Active Pokémon have the same amount of Energy, damage done to this Pokémon by attacks is prevented.
  modifyIncomingDamage(q) {
    if (!sameRef(q.holder, q.defender) || q.attacker.player === q.holder.player) return q.amount;
    const mine = slotAt(q.state, q.holder)?.energy.length;
    const theirs = slotAt(q.state, { player: q.attacker.player, zone: 'active' })?.energy.length;
    return mine === theirs ? 0 : q.amount;
  },
  attacks: {
    // Psypower: put 3 damage counters on your opponent's Pokémon in any way you like.
    0: {
      effect(ctx) {
        for (let i = 0; i < 3; i++) {
          const [ref] = ctx.chooseSlot({
            player: ctx.me,
            among: inPlayRefs(ctx, ctx.opp),
            min: 1,
            max: 1,
            message: `Put a damage counter on which Pokémon? (${3 - i} left)`,
          });
          ctx.placeCounters(ref!, 1);
        }
      },
    },
  },
};
