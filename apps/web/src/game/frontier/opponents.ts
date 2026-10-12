import { nextRandom, type DeckList } from '@ptcg/engine';
import { GYM_DECKS } from '@ptcg/cards';
import { DECKS, registry, type DeckId } from '../catalog.ts';
import { LEADERS } from '../gym.ts';

/** One of the 8 opponents of a Frontier run, drawn when the run starts. */
export interface FrontierOpponent {
  /** A catalog deck (starter, theme, meta) or a Gym Leader's deck. */
  source: 'catalog' | 'gym';
  /** DeckId, or a Gym Leader's id. */
  id: string;
  name: string;
  type: string;
  /** Card id shown as the deck's picture. */
  cover: string;
  difficulty: 'easy' | 'medium' | 'hard';
  /** The Frontier Brain's name (the boss only). */
  brain?: string;
}

/** The boss of a run: an original Frontier Brain for each meta deck. */
export const FRONTIER_BRAINS: Record<string, { name: string; intro: string; win: string; lose: string }> = {
  'meta-dragapult': {
    name: 'Vesper',
    intro:
      'I am Vesper, Brain of the Frontier. My dragons strike from the shadows — will you even see them coming?',
    win: 'You read every one of my phantoms. The Frontier salutes you!',
    lose: 'Swift and silent. The Frontier ends here for you.',
  },
  'meta-alakazam': {
    name: 'Quill',
    intro:
      'Quill, Frontier Brain. I have already foreseen this battle. Let us see if you can change its ending.',
    win: 'An outcome I did not predict... Remarkable. You have conquered the Frontier!',
    lose: 'Exactly as I foresaw. Train your mind and return.',
  },
  'meta-ogerpon-box': {
    name: 'Thorne',
    intro: 'I am Thorne. Four masks, one will. My team adapts to anything you bring!',
    win: 'Every mask has fallen. The Frontier is yours!',
    lose: 'You could not find the right answer to my masks. Come back stronger.',
  },
  'meta-ns-zoroark': {
    name: 'Nox',
    intro: "Nox, Frontier Brain. Illusions are my craft — what you see isn't what you'll face.",
    win: 'You saw through every illusion. The Frontier bows to you!',
    lose: 'Fooled to the very end. The run is over.',
  },
  'meta-slowking': {
    name: 'Brine',
    intro: 'Brine here. I take my time, and I always find the move I need. Patience wins at the Frontier.',
    win: 'You out-thought the tide itself. Congratulations, champion of the Frontier!',
    lose: 'The tide always turns my way. Rest, then try again.',
  },
  'meta-crustle': {
    name: 'Granite',
    intro: 'I am Granite. My wall has never been broken. Hit it as hard as you like!',
    win: 'My wall... crumbled. You are a true Frontier champion!',
    lose: 'Not a crack. The Frontier stands, and your run ends.',
  },
};

const STAGE_RANK = { Basic: 0, Stage1: 1, Stage2: 2 } as const;

/** The deck's first Pokémon of its highest stage, as its picture. */
function coverOf(deck: DeckList): string {
  let best = deck.cards[0]!.id;
  let rank = -1;
  for (const c of deck.cards) {
    const d = registry.defs[c.id];
    if (d?.category === 'Pokemon' && STAGE_RANK[d.stage] > rank) {
      best = c.id;
      rank = STAGE_RANK[d.stage];
    }
  }
  return best;
}

const catalog = (id: string, difficulty: FrontierOpponent['difficulty']): FrontierOpponent => {
  const d = DECKS.find((x) => x.id === id)!;
  return { source: 'catalog', id, name: d.name, type: d.type, cover: d.cover, difficulty };
};
const gym = (id: string, difficulty: FrontierOpponent['difficulty']): FrontierOpponent => {
  const leader = LEADERS.find((l) => l.id === id)!;
  return {
    source: 'gym',
    id,
    name: `${leader.name}'s deck`,
    type: leader.type,
    cover: coverOf(opponentDeck({ source: 'gym', id })),
    difficulty,
  };
};

/** The 8 opponents of a run, the same for the same seed; none repeats and none is the player's starter deck. */
export function drawOpponents(seed: number, starterId: string): FrontierOpponent[] {
  let rng = (seed ^ 0x5bd1e995) >>> 0;
  const take = <T>(from: T[], n: number): T[] => {
    const out: T[] = [];
    for (let i = 0; i < n; i++) {
      const [v, next] = nextRandom(rng);
      rng = next;
      out.push(from.splice(Math.floor(v * from.length), 1)[0]!);
    }
    return out;
  };
  const ids = (kind: string) => DECKS.filter((d) => d.kind === kind && d.id !== starterId).map((d) => d.id);
  const meta = ids('meta');
  const themes = ids('theme');
  // Hard first, so the boss and fight 7 always have two meta decks.
  const hard = take(meta, 2);
  const mediumPool = [
    ...themes.map((id) => `catalog:${id}`),
    ...LEADERS.map((l) => `gym:${l.id}`),
    ...meta.map((id) => `catalog:${id}`),
  ];
  const medium = take(mediumPool, 3);
  const usedThemes = new Set(medium.filter((m) => m.startsWith('catalog:')).map((m) => m.slice(8)));
  const easy = take([...ids('starter'), ...themes.filter((t) => !usedThemes.has(t))], 3);

  const boss = catalog(hard[1]!, 'hard');
  return [
    ...easy.map((id) => catalog(id, 'easy')),
    ...medium.map((m) => {
      const [source, id] = m.split(':') as ['catalog' | 'gym', string];
      return source === 'gym' ? gym(id, 'medium') : catalog(id, 'medium');
    }),
    catalog(hard[0]!, 'hard'),
    { ...boss, brain: FRONTIER_BRAINS[boss.id]!.name },
  ];
}

/** The deck an opponent plays. */
export function opponentDeck(o: Pick<FrontierOpponent, 'source' | 'id'>): DeckList {
  if (o.source === 'gym') {
    const leader = LEADERS.find((l) => l.id === o.id)!;
    return GYM_DECKS[leader.deck];
  }
  return DECKS.find((d) => d.id === (o.id as DeckId))!.list;
}
