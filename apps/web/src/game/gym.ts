import type { DeckList, EnergyType } from '@ptcg/engine';
import type { GymDeckId } from '@ptcg/cards';

/** Kanto Gym Challenge data and rules. Everything here is pure; the profile applies the results. */

export type DeckRef = { kind: 'starter' | 'theme' | 'meta' | 'custom'; id: string };

/** The deck a run is locked to: a copy of its contents, so editing or deleting the deck later changes nothing. */
export interface RunDeck extends DeckRef {
  name: string;
  /** Card id shown as the deck's picture. */
  cover: string;
  cards: { id: string; count: number }[];
}

export interface HallOfFameEntry {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  playerName: string;
  deckName: string;
  /** Card id shown as the deck's picture. */
  cover: string;
}

export interface EliteRun {
  /** Next opponent: 0 Lorelei, 1 Bruno, 2 Agatha, 3 Lance, 4 Champion Blue. */
  stage: number;
  /** The player's deck, locked for the whole run. */
  deck: RunDeck;
  /** A match of this run has started and not finished: leaving it (quitting, reloading) counts as a loss. */
  inMatch?: boolean;
}

export interface GymProgress {
  /** Earned badge ids, in the order earned. */
  badges: string[];
  run: EliteRun | null;
  /** Newest first. */
  hallOfFame: HallOfFameEntry[];
}

export const emptyGym = (): GymProgress => ({ badges: [], run: null, hallOfFame: [] });

export interface Opponent {
  id: string;
  name: string;
  /** Gym Leader badge name (gym leaders only). */
  badge?: string;
  /** Type shown on the tile. */
  type: string;
  deck: GymDeckId;
  difficulty: 'easy' | 'medium' | 'hard';
  intro: string;
  win: string;
  lose: string;
}

/** The 8 gyms, in the order they must be beaten. */
export const LEADERS: readonly Opponent[] = [
  {
    id: 'brock',
    name: 'Brock',
    badge: 'Boulder',
    type: 'Fighting',
    deck: 'brock',
    difficulty: 'easy',
    intro:
      "I'm Brock! I'm Pewter's Gym Leader. My rock-hard willpower is reflected by my Pokémon. Show me your best!",
    win: 'Your Pokémon were stronger than my rocks. Take the Boulder Badge!',
    lose: 'As expected, rock-types are hard to beat. Train some more and come back!',
  },
  {
    id: 'misty',
    name: 'Misty',
    badge: 'Cascade',
    type: 'Water',
    deck: 'misty',
    difficulty: 'easy',
    intro: "Hi, you're a new face! I'm Misty. My policy is an all-out offensive with water-type Pokémon!",
    win: "Wow! You're too much! All right, you can have the Cascade Badge.",
    lose: "Is that all? You'll need a lot more practice before you can beat my Water Pokémon!",
  },
  {
    id: 'surge',
    name: 'Lt. Surge',
    badge: 'Thunder',
    type: 'Lightning',
    deck: 'surge',
    difficulty: 'easy',
    intro: "Hey, kid! What do you think you're doing here? You won't live long in combat! I'm Lt. Surge!",
    win: "Now that's a shocker! You are the real deal, kid! Take the Thunder Badge!",
    lose: "Ha ha ha! Lightning-fast attacks are what I'm all about. Get back in the ring when you're ready!",
  },
  {
    id: 'erika',
    name: 'Erika',
    badge: 'Rainbow',
    type: 'Grass',
    deck: 'erika',
    difficulty: 'easy',
    intro: "Hello. Lovely weather isn't it? It's so pleasant... I'm Erika, the Gym Leader. Shall we battle?",
    win: 'Oh! I concede defeat. You are remarkably strong. Please take the Rainbow Badge.',
    lose: 'Oh, dear. I have won, it seems. Please try again when the flowers bloom!',
  },
  {
    id: 'koga',
    name: 'Koga',
    badge: 'Soul',
    type: 'Darkness',
    deck: 'koga',
    difficulty: 'medium',
    intro: 'Fwahahaha! A mere child like you dares to challenge me? Very well. I shall show you true terror!',
    win: 'Humph! You have proven your worth! Here! Take the Soul Badge!',
    lose: 'Fwahaha! Poison and confusion beat many a challenger. Come back when you can resist them!',
  },
  {
    id: 'sabrina',
    name: 'Sabrina',
    badge: 'Marsh',
    type: 'Psychic',
    deck: 'sabrina',
    difficulty: 'medium',
    intro:
      'I had a vision of your arrival! I have had psychic powers since I was little. I dislike battling, but if you wish, I will show you my powers!',
    win: "I am shocked! But a loss is a loss. I admit I didn't work hard enough to win. Take the Marsh Badge!",
    lose: 'I knew I would win. My vision never fails. Try again after you have trained.',
  },
  {
    id: 'blaine',
    name: 'Blaine',
    badge: 'Volcano',
    type: 'Fire',
    deck: 'blaine',
    difficulty: 'medium',
    intro:
      "Hah! I am Blaine, the red-hot Leader of Cinnabar Gym! My fiery Pokémon are all fired up and ready. You'd better have a Burn Heal!",
    win: "I've burnt out! You have earned the Volcano Badge!",
    lose: 'Hah! My fire Pokémon are too hot for you. Cool off, then try again!',
  },
  {
    id: 'giovanni',
    name: 'Giovanni',
    badge: 'Earth',
    type: 'Darkness + Fighting',
    deck: 'giovanni',
    difficulty: 'medium',
    intro:
      'So, you are the one who has been making trouble for Team Rocket. I am Giovanni, the Leader of this Gym. Do not expect any mercy!',
    win: 'Ha! That was a truly intense fight. You have won! As proof, here is the Earth Badge!',
    lose: 'Is that all? You are no match for me. Come back when you are stronger!',
  },
];

/** The Elite Four and the Champion, fought in this order in one run. */
export const ELITE: readonly Opponent[] = [
  {
    id: 'lorelei',
    name: 'Lorelei',
    type: 'Water',
    deck: 'lorelei',
    difficulty: 'medium',
    intro:
      'Welcome to the Pokémon League! I am Lorelei of the Elite Four. No one can best me when it comes to icy Pokémon!',
    win: 'How dare you! You have bested me. The next Elite Four member awaits.',
    lose: 'Your Pokémon froze in fear. The run ends here. Come back from the start when you are ready.',
  },
  {
    id: 'bruno',
    name: 'Bruno',
    type: 'Fighting',
    deck: 'bruno',
    difficulty: 'medium',
    intro:
      'I am Bruno of the Elite Four! Through rigorous training, people and Pokémon can become stronger. Hoo hah!',
    win: 'Why? How could I lose? Go on, face the next challenge!',
    lose: 'Hoo hah! My Pokémon are too strong for you. Return to the start of the run and train!',
  },
  {
    id: 'agatha',
    name: 'Agatha',
    type: 'Psychic + Darkness',
    deck: 'agatha',
    difficulty: 'medium',
    intro:
      "I am Agatha of the Elite Four! Oak's taken a lot of interest in you, child. But a battle is a battle — let's see what you've got!",
    win: 'You win! I see what the old duff sees in you now. Go on, child!',
    lose: "Hee hee hee! You're all talk, child. The run ends here.",
  },
  {
    id: 'lance',
    name: 'Lance',
    type: 'Water + Lightning',
    deck: 'lance',
    difficulty: 'medium',
    intro: "I've been waiting for you! I am Lance, the dragon master. Prepare to face my Dragon Pokémon!",
    win: "That's it! I hate to admit it, but you are a Pokémon master! The Champion awaits.",
    lose: 'My dragons are unmatched. The run ends here. Try again!',
  },
  {
    id: 'champion',
    name: 'Champion Blue',
    type: 'Psychic + ace',
    deck: 'blue-fire', // replaced by championDeckFor() when the match starts
    difficulty: 'medium',
    intro:
      "Hey! I was looking forward to seeing you, my rival! My rival should be strong to keep me sharp. Let's see if you're good enough!",
    win: "NO! That can't be! You beat my best! You are the new Champion!",
    lose: "Hah! I'm the Champion. You're not ready yet. The run ends here.",
  },
];

/** Johto, unlocked by beating the Kanto Champion. Leaders are fought in this order, like Kanto's. */
export type Region = 'kanto' | 'johto';

export const JOHTO_LEADERS: readonly Opponent[] = [
  {
    id: 'falkner',
    name: 'Falkner',
    badge: 'Zephyr',
    type: 'Flying',
    deck: 'falkner',
    difficulty: 'medium',
    intro:
      "I'm Falkner, the Violet City Gym Leader! People say Flying-type Pokémon are weak, but I'll show you the glory of the elegant bird Pokémon!",
    win: "...I understand. I'll admit that you won fair and square. Take the Zephyr Badge!",
    lose: 'Hmm, I knew it. Flying-type Pokémon are the best! Come back when your skills have improved!',
  },
  {
    id: 'bugsy',
    name: 'Bugsy',
    badge: 'Hive',
    type: 'Grass + Metal',
    deck: 'bugsy',
    difficulty: 'medium',
    intro:
      "I'm Bugsy! I never lose when it comes to Bug Pokémon. My research is going to make me the authority on Bug Pokémon!",
    win: "Wow, amazing! You're an expert on Pokémon! My research isn't complete yet. OK, you win. Take the Hive Badge!",
    lose: 'Bug Pokémon are fascinating, and you have a lot more to learn about them. Come back and try again!',
  },
  {
    id: 'whitney',
    name: 'Whitney',
    badge: 'Plain',
    type: 'Normal',
    deck: 'whitney',
    difficulty: 'hard',
    intro: "Hi! I'm Whitney! Everyone thinks my Pokémon are super cute! Are you going to be a crybaby?",
    win: '...Sniff... What? Waaaaah! You meanie! All right, all right, take the Plain Badge!',
    lose: "Yay, I won! Didn't I tell you my Pokémon were the best? Come back when you're tougher!",
  },
  {
    id: 'morty',
    name: 'Morty',
    badge: 'Fog',
    type: 'Darkness',
    deck: 'morty',
    difficulty: 'hard',
    intro:
      "I see a bright future for myself! I'm Morty, the Ecruteak Gym Leader. Let me show you the power I've gained from my training!",
    win: "I'm not good enough yet... All right. The Fog Badge is yours.",
    lose: 'I knew it. The Ghost Pokémon I trained with are far from done with you. Come back stronger!',
  },
  {
    id: 'chuck',
    name: 'Chuck',
    badge: 'Storm',
    type: 'Fighting',
    deck: 'chuck',
    difficulty: 'hard',
    intro:
      "Wahahah! I'm Chuck, the Cianwood Gym Leader! I train under a waterfall every day, and I have never lost my fighting spirit. Come on, let's brawl!",
    win: 'Wha? Wahaha! I enjoyed battling you! Here, take the Storm Badge!',
    lose: 'Wahahah! Not even close! Hit the waterfall and train some more, then come back!',
  },
  {
    id: 'jasmine',
    name: 'Jasmine',
    badge: 'Mineral',
    type: 'Metal',
    deck: 'jasmine',
    difficulty: 'hard',
    intro:
      "...Um... I'm Jasmine, the Olivine Gym Leader. I use the Steel type. ...Do you know it? It's strong and unyielding. ...Shall we begin?",
    win: '...You are a better Trainer than me, in both skill and kindness. In accordance with League rules, I confer upon you this Mineral Badge.',
    lose: '...I am sorry. My Steel Pokémon held firm. Please try again when you are ready.',
  },
  {
    id: 'pryce',
    name: 'Pryce',
    badge: 'Glacier',
    type: 'Water',
    deck: 'pryce',
    difficulty: 'hard',
    intro:
      'I have been training Pokémon since before you were born, young one. In all that time, I have seen it all. Allow me to show you the strength of the cold!',
    win: 'Hmm... You have proven yourself. The Glacier Badge is yours; wear it with pride.',
    lose: 'Ho ho. My years of experience carried the day. Come back after you have learned a few more things.',
  },
  {
    id: 'clair',
    name: 'Clair',
    badge: 'Rising',
    type: 'Dragon',
    deck: 'clair',
    difficulty: 'hard',
    intro:
      "I am Clair. The world's best Dragon master. I can hold my own against anyone. Do not expect me to go easy on you, just because you made it this far!",
    win: "I lost... I can't believe it. Fine. You have earned the Rising Badge.",
    lose: 'As expected of the Dragon masters. You are not ready for the Rising Badge. Train, then return.',
  },
];

/** Places in the Johto badge case. */
export const JOHTO_TOTAL = JOHTO_LEADERS.length;

export const leadersOf = (region: Region): readonly Opponent[] =>
  region === 'johto' ? JOHTO_LEADERS : LEADERS;

/** A Gym Leader of either region by id. */
export const findLeader = (id: string): Opponent | undefined =>
  LEADERS.find((l) => l.id === id) ?? JOHTO_LEADERS.find((l) => l.id === id);

export const regionOf = (id: string): Region | null =>
  LEADERS.some((l) => l.id === id) ? 'kanto' : JOHTO_LEADERS.some((l) => l.id === id) ? 'johto' : null;

/** Johto opens once the Kanto Champion has been beaten (a Hall of Fame entry exists). */
export const johtoUnlocked = (g: GymProgress): boolean => g.hallOfFame.length > 0;

/** Johto badge rewards are Mega Evolution era packs. */
export const JOHTO_PACK_SET = 'me02';

/** Credits for a first Johto badge: 150, plus 25 for each later gym. Each also gives one Mega Evolution pack. */
export const johtoBadgeReward = (gymIndex: number): Payout => ({
  credits: 150 + 25 * gymIndex,
  packs: 1,
  set: JOHTO_PACK_SET,
});

export const CHAMPION_STAGE = ELITE.length - 1;

/** Credits for a first badge: 100 for Brock, plus 25 for each later gym. Each also gives one 151 pack. */
export const badgeReward = (gymIndex: number): Payout => ({
  credits: 100 + 25 * gymIndex,
  packs: 1,
});

/** The Champion pays more the first time. */
export const championReward = (first: boolean): { credits: number; packs: number } =>
  first ? { credits: 1000, packs: 3 } : { credits: 300, packs: 1 };

/** How many gyms of a region (Kanto by default) have been beaten in order (the index of the next gym). */
export function nextGymIndex(badges: readonly string[], leaders: readonly Opponent[] = LEADERS): number {
  let i = 0;
  while (i < leaders.length && badges.includes(leaders[i]!.id)) i++;
  return i;
}

export type GymStatus = 'beaten' | 'next' | 'locked';

export function gymStatus(badges: readonly string[], leaderId: string): GymStatus {
  const region = regionOf(leaderId);
  if (!region) return 'locked';
  const leaders = leadersOf(region);
  if (badges.includes(leaderId)) return 'beaten';
  return leaders.findIndex((l) => l.id === leaderId) === nextGymIndex(badges, leaders) ? 'next' : 'locked';
}

/** Only the next unbeaten gym, or any beaten one (a rematch), can be challenged. */
export const canChallenge = (badges: readonly string[], leaderId: string): boolean =>
  gymStatus(badges, leaderId) !== 'locked';

export const canStartElite = (badges: readonly string[]): boolean =>
  nextGymIndex(badges, LEADERS) === LEADERS.length;

/** The most common Basic Energy type in a deck, or null when it has none. */
export function mainEnergyType(
  deck: DeckList,
  defs: Readonly<Record<string, { category: string; energyKind?: string; provides?: EnergyType[] }>>,
): EnergyType | null {
  const counts = new Map<EnergyType, number>();
  for (const c of deck.cards) {
    const d = defs[c.id];
    if (d?.category !== 'Energy' || d.energyKind !== 'Basic' || !d.provides?.[0]) continue;
    counts.set(d.provides[0], (counts.get(d.provides[0]) ?? 0) + c.count);
  }
  let best: EnergyType | null = null;
  for (const [t, n] of counts) if (best === null || n > counts.get(best)!) best = t;
  return best;
}

/** Blue's ace counters the challenger's main Energy: Fire → Blastoise, Grass → Charizard, Water → Venusaur, else Charizard. */
export function championDeckFor(main: EnergyType | null): GymDeckId {
  switch (main) {
    case 'Fire':
      return 'blue-water';
    case 'Water':
      return 'blue-grass';
    default:
      return 'blue-fire';
  }
}

export interface Payout {
  credits: number;
  packs: number;
  /** The set the packs come from; the 151 set when absent. */
  set?: string;
}

/**
 * Applies a finished gym match. Only the first win over each gym earns its badge and reward;
 * the caller pays the normal bot credits for everything else (`reward` is null then).
 */
export function applyGymResult(
  g: GymProgress,
  leaderId: string,
  won: boolean,
): { next: GymProgress; reward: Payout | null } {
  const region = regionOf(leaderId);
  const leaders = region ? leadersOf(region) : LEADERS;
  const index = leaders.findIndex((l) => l.id === leaderId);
  if (!won || !region || g.badges.includes(leaderId) || index !== nextGymIndex(g.badges, leaders)) {
    return { next: g, reward: null };
  }
  const reward = region === 'johto' ? johtoBadgeReward(index) : badgeReward(index);
  return { next: { ...g, badges: [...g.badges, leaderId] }, reward };
}

/** Starts an Elite Four run with a locked deck (needs all 8 badges); an unfinished run is kept as it is. */
export function startRun(g: GymProgress, deck: RunDeck): GymProgress {
  if (!canStartElite(g.badges) || g.run) return g;
  return { ...g, run: { stage: 0, deck } };
}

/**
 * Applies a finished Elite Four or Champion match: a loss ends the run, a win moves on, a draw replays the
 * same match (the run stays where it is), and beating the Champion ends the run with a Hall of Fame entry and
 * the Champion reward. A result for a stage the run is not at (or with no run, e.g. the other tab already moved
 * on) changes nothing and is marked `stale`.
 */
export function applyEliteResult(
  g: GymProgress,
  stage: number,
  won: boolean,
  entry: HallOfFameEntry,
  draw = false,
): { next: GymProgress; reward: Payout | null; stale?: true } {
  if (!g.run || g.run.stage !== stage) return { next: g, reward: null, stale: true };
  if (draw) {
    return { next: { ...g, run: { stage: g.run.stage, deck: g.run.deck } }, reward: null };
  }
  if (!won) return { next: { ...g, run: null }, reward: null };
  if (stage < CHAMPION_STAGE) {
    return { next: { ...g, run: { deck: g.run.deck, stage: stage + 1 } }, reward: null };
  }
  const first = g.hallOfFame.length === 0;
  return { next: { ...g, run: null, hallOfFame: [entry, ...g.hallOfFame] }, reward: championReward(first) };
}

/** Marks the run's match for `stage` as started (see `EliteRun.inMatch`). */
export function beginMatch(g: GymProgress, stage: number): GymProgress {
  return g.run && g.run.stage === stage && !g.run.inMatch ? { ...g, run: { ...g.run, inMatch: true } } : g;
}

/** A match that was started but never finished (the player quit or reloaded) is a loss: the run ends. */
export function abandonUnfinishedRun(g: GymProgress): GymProgress {
  return g.run?.inMatch ? { ...g, run: null } : g;
}

const isString = (x: unknown): x is string => typeof x === 'string';

/** Fills in or repairs the saved challenge progress (older profiles have none). */
export function normalizeGym(raw: unknown): GymProgress {
  const g = (raw ?? {}) as Partial<Record<keyof GymProgress, unknown>>;
  const ids = new Set([...LEADERS, ...JOHTO_LEADERS].map((l) => l.id));
  const badges = Array.isArray(g.badges)
    ? [...new Set(g.badges.filter((b): b is string => isString(b) && ids.has(b)))]
    : [];
  const r = g.run as Partial<EliteRun> | null | undefined;
  const kinds = ['starter', 'theme', 'meta', 'custom'];
  const d = r?.deck as Partial<RunDeck> | undefined;
  const cards =
    Array.isArray(d?.cards) &&
    d.cards.every((c) => !!c && isString(c.id) && Number.isInteger(c.count) && c.count > 0)
      ? d.cards.map((c) => ({ id: c.id, count: c.count }))
      : null;
  const run =
    r &&
    typeof r.stage === 'number' &&
    Number.isInteger(r.stage) &&
    r.stage >= 0 &&
    r.stage <= CHAMPION_STAGE &&
    d &&
    kinds.includes(d.kind as string) &&
    isString(d.id) &&
    isString(d.name) &&
    isString(d.cover) &&
    cards &&
    canStartElite(badges)
      ? {
          stage: r.stage,
          deck: { kind: d.kind as RunDeck['kind'], id: d.id, name: d.name, cover: d.cover, cards },
          ...(r.inMatch === true ? { inMatch: true } : {}),
        }
      : null;
  const hallOfFame = Array.isArray(g.hallOfFame)
    ? g.hallOfFame
        .filter(
          (e): e is HallOfFameEntry =>
            !!e &&
            isString((e as HallOfFameEntry).date) &&
            isString((e as HallOfFameEntry).playerName) &&
            isString((e as HallOfFameEntry).deckName) &&
            isString((e as HallOfFameEntry).cover),
        )
        .slice(0, 200)
    : [];
  return { badges, run, hallOfFame };
}
