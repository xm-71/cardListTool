import type { EventAnim, GameEvent, PlayerId } from '@ptcg/engine';

/**
 * One step of what happened, played in order on the board. Pokémon in play are named by the first card of their
 * stack (see `EventAnim`); `text` is what the log says and `event` the log event it came from (the ticker reads it).
 */
export type Beat = (
  | { kind: 'turn'; player: PlayerId }
  | { kind: 'draw'; player: PlayerId }
  | { kind: 'attack'; by: string; target: string | null }
  | { kind: 'note' }
  | Exclude<EventAnim, { kind: 'attack' }>
) & { text: string; event: GameEvent };

/** How long each kind of beat takes at Normal speed, in ms. A note only carries text. */
const MS: Record<Beat['kind'], number> = {
  turn: 1100,
  draw: 400,
  attack: 500,
  damage: 800,
  knockout: 900,
  prize: 500,
  promote: 450,
  retreat: 450,
  bench: 450,
  trainer: 700,
  energy: 600,
  evolve: 900,
  coin: 1200,
  condition: 800,
  checkup: 800,
  note: 0,
};

export const beatMs = (beat: Beat): number => MS[beat.kind];

/** The beats for the log events one move added, in order. */
export function beatsFor(events: readonly GameEvent[]): Beat[] {
  const beats: Beat[] = [];
  events.forEach((e, i) => {
    if (e.type === 'turnStart' && e.player !== undefined) {
      const draw: GameEvent = { type: 'draw', player: e.player, text: `Player ${e.player + 1} draws a card` };
      beats.push({ kind: 'turn', player: e.player, text: e.text, event: e });
      beats.push({ kind: 'draw', player: e.player, text: draw.text, event: draw });
      return;
    }
    const anim = e.anim;
    if (!anim) {
      beats.push({ kind: 'note', text: e.text, event: e });
      return;
    }
    if (anim.kind === 'attack') {
      // The attacker lunges at the Pokémon the attack's first damage lands on.
      const hit = events.slice(i + 1).find((x) => x.anim?.kind === 'damage')?.anim;
      beats.push({ ...anim, target: hit?.kind === 'damage' ? hit.target : null, text: e.text, event: e });
      return;
    }
    beats.push({ ...anim, text: e.text, event: e });
  });
  return beats;
}
