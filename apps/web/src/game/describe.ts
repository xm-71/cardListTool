import type { GameEvent, PlayerId } from '@ptcg/engine';
import { ELITE, LEADERS } from './gym.ts';
import type { GameConfig } from './store.ts';

/** Who is who, for putting log lines in plain words from one player's side. */
export interface Names {
  viewer: PlayerId;
  /** What the other player is called ("Brock", "Rival", "Player 2"). */
  opponent: string;
  /** The owner of a card, when known. */
  ownerOf(uid: string): PlayerId | undefined;
}

/** The opponent's name: the Gym Leader or Elite Four member, the other seat in hotseat, else "Rival". */
export function opponentName(config: Pick<GameConfig, 'mode' | 'context'>, viewer: PlayerId): string {
  const ctx = config.context;
  if (ctx?.kind === 'gym') return LEADERS.find((l) => l.id === ctx.leaderId)?.name ?? 'Rival';
  if (ctx?.kind === 'elite') return ELITE[ctx.stage]?.name ?? 'Rival';
  if (config.mode === 'hotseat') return `Player ${viewer === 0 ? 2 : 1}`;
  return 'Rival';
}

/** Verbs the engine writes after "Player N", and what they become after "You". */
const YOU_VERB: Record<string, string> = {
  plays: 'play',
  takes: 'take',
  attaches: 'attach',
  retreats: 'retreat',
  promotes: 'promote',
  ends: 'end',
  reveals: 'reveal',
  wins: 'win',
  uses: 'use',
  mulligans: 'mulligan',
  goes: 'go',
  draws: 'draw',
};

/** Which card the line is about, for "Your Gastly …" / "Brock's Onix …". */
function subject(e: GameEvent): string | undefined {
  const a = e.anim;
  if (!a) return undefined;
  switch (a.kind) {
    case 'attack':
      return a.by;
    case 'damage':
    case 'knockout':
    case 'condition':
    case 'checkup':
      return a.target;
    case 'bench':
      return a.uid;
    default:
      return undefined;
  }
}

/** A log line in plain words from the viewer's side: "You play Nest Ball", "Brock's Onix uses Rock Throw". */
export function describeEvent(e: GameEvent, names: Names): string {
  const who = (p: PlayerId) => (p === names.viewer ? 'You' : names.opponent);
  if (e.type === 'turnStart' && e.player !== undefined) {
    const turn = e.text.match(/^Turn \d+/)?.[0] ?? 'Turn';
    return `${turn}: ${e.player === names.viewer ? 'Your' : `${names.opponent}'s`} turn`;
  }
  let text = e.text.replace(/Player (\d)/g, (_, n: string) => who((Number(n) - 1) as PlayerId));
  // "You plays … and goes first" → "You play … and go first"; "their turn" → "your turn".
  if (text.startsWith('You ')) {
    text = text
      .replace(
        /\b(plays|takes|attaches|retreats|promotes|ends|reveals|wins|uses|mulligans|goes|draws)\b/g,
        (v) => YOU_VERB[v]!,
      )
      .replace(/\btheir turn\b/, 'your turn');
  }
  const uid = subject(e);
  const owner = uid ? names.ownerOf(uid) : undefined;
  if (owner !== undefined) text = `${owner === names.viewer ? 'Your' : `${names.opponent}'s`} ${text}`;
  return text;
}
