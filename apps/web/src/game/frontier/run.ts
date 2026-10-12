import { nextRandom, type EnergyType } from '@ptcg/engine';
import { DECKS, registry } from '../catalog.ts';
import { applyChange, runDeckProblems, type RunCards } from './deck.ts';
import { offersFor, type Offer } from './offers.ts';
import { drawOpponents, type FrontierOpponent } from './opponents.ts';
import { frontierPool } from './pool.ts';

/** A Battle Frontier run, saved in the profile. Every function here returns a new run and never mutates. */
export interface FrontierRun {
  seed: number;
  phase: 'starter' | 'hub' | 'reward' | 'over';
  /** The 3 starter DeckIds offered, in seeded order. */
  starterChoices: string[];
  starterId: string | null;
  /** 0..7: the next (or current) fight. */
  fight: number;
  lives: number;
  /** Fights won. */
  wins: number;
  deck: RunCards;
  /** The starter deck's cover card. */
  cover: string;
  opponents: FrontierOpponent[];
  /** The offers after a win (phase 'reward'). */
  offers: Offer[] | null;
  /** A fight has started and not been recorded: leaving it counts as a loss. */
  inMatch?: boolean;
  /** The game seed of the fight in progress: only that game's result counts (not an older attempt's, from another tab). */
  matchSeed?: number;
  cleared?: boolean;
}

export const FIGHTS = 8;
export const LIVES = 2;
/** Credits per fight won, by difficulty, and the bonus for beating the boss. */
export const FIGHT_CREDITS = { easy: 60, medium: 120, hard: 200 } as const;
export const BOSS_BONUS = 300;

/** The Mega Evolution basic Energy card for each type a Tune-up can add. */
export const BASIC_ENERGY: Partial<Record<EnergyType, string>> = {
  Grass: 'mee-001',
  Fire: 'mee-002',
  Water: 'mee-003',
  Lightning: 'mee-004',
  Psychic: 'mee-005',
  Fighting: 'mee-006',
  Darkness: 'mee-007',
  Metal: 'mee-008',
};

const size = (cards: RunCards) => cards.reduce((n, c) => n + c.count, 0);
const need = (r: FrontierRun, phase: FrontierRun['phase']) => {
  if (r.phase !== phase) throw new Error(`Frontier run is in phase ${r.phase}, not ${phase}`);
};

/** A new run, waiting for its starter deck to be picked. */
export function newRun(seed: number): FrontierRun {
  const pool = DECKS.filter((d) => d.kind === 'starter').map((d) => d.id as string);
  let rng = seed >>> 0;
  const choices: string[] = [];
  while (pool.length) {
    const [v, next] = nextRandom(rng);
    rng = next;
    choices.push(pool.splice(Math.floor(v * pool.length), 1)[0]!);
  }
  return {
    seed,
    phase: 'starter',
    starterChoices: choices.slice(0, 3),
    starterId: null,
    fight: 0,
    lives: LIVES,
    wins: 0,
    deck: [],
    cover: '',
    opponents: [],
    offers: null,
  };
}

export function chooseStarter(r: FrontierRun, id: string): FrontierRun {
  need(r, 'starter');
  if (!r.starterChoices.includes(id)) throw new Error(`${id} is not one of this run's starter decks`);
  const deck = DECKS.find((d) => d.id === id)!;
  return {
    ...r,
    phase: 'hub',
    starterId: id,
    deck: deck.list.cards.map((c) => ({ id: c.id, count: c.count })),
    cover: deck.cover,
    opponents: drawOpponents(r.seed, id),
  };
}

export function beginFight(r: FrontierRun, matchSeed?: number): FrontierRun {
  need(r, 'hub');
  return { ...r, inMatch: true, ...(matchSeed === undefined ? {} : { matchSeed }) };
}

export function recordResult(r: FrontierRun, outcome: 'win' | 'loss' | 'draw'): FrontierRun {
  need(r, 'hub');
  const base: FrontierRun = { ...r, inMatch: false };
  delete base.matchSeed;
  if (outcome === 'draw') return base;
  if (outcome === 'loss') {
    const lives = r.lives - 1;
    return { ...base, lives, phase: lives > 0 ? 'hub' : 'over' };
  }
  const wins = r.wins + 1;
  if (r.fight === FIGHTS - 1) return { ...base, wins, phase: 'over', cleared: true };
  const offers = offersFor({ seed: r.seed, fight: r.fight, deck: r.deck }, frontierPool(), registry);
  return { ...base, wins, phase: 'reward', offers };
}

/** Takes offer `index`. A package cuts exactly its size; a Tune-up cuts 0–3 cards, one basic Energy per type given. */
export function takeOffer(
  r: FrontierRun,
  index: number,
  cut: RunCards,
  energyTypes: EnergyType[] = [],
): FrontierRun {
  need(r, 'reward');
  const offer = r.offers?.[index];
  if (!offer) throw new Error(`No offer ${index}`);
  let add: RunCards;
  if (offer.kind === 'package') {
    add = offer.pkg.cards;
    if (size(cut) !== size(add)) throw new Error(`Cut ${size(add)} cards, not ${size(cut)}`);
  } else {
    if (size(cut) > 3 || energyTypes.length !== size(cut))
      throw new Error('A Tune-up swaps up to 3 cards for Energy');
    add = applyChange(
      [],
      energyTypes.map((t) => {
        const id = BASIC_ENERGY[t];
        if (!id) throw new Error(`No basic ${t} Energy`);
        return { id, count: 1 };
      }),
      [],
    );
  }
  const merged = applyChange(r.deck, add, []);
  for (const c of cut) {
    const have = merged.find((m) => m.id === c.id)?.count ?? 0;
    if (c.count < 1 || c.count > have) throw new Error(`Can't cut ${c.count} ${c.id}`);
  }
  const deck = applyChange(r.deck, add, cut);
  const problems = runDeckProblems(deck, registry);
  if (problems.length) throw new Error(problems.join('; '));
  return { ...r, deck, phase: 'hub', fight: r.fight + 1, offers: null };
}

export function skipOffer(r: FrontierRun): FrontierRun {
  need(r, 'reward');
  return { ...r, phase: 'hub', fight: r.fight + 1, offers: null };
}

/** Ends the run as a loss; fights already won still pay. */
export function abandon(r: FrontierRun): FrontierRun {
  if (r.phase === 'over') return r;
  return { ...r, phase: 'over', inMatch: false, cleared: false, offers: null };
}

/** Credits the run pays: each fight won by difficulty, plus the boss bonus for a clear. */
export const payout = (r: FrontierRun): number =>
  r.opponents.slice(0, r.wins).reduce((n, o) => n + FIGHT_CREDITS[o.difficulty], 0) +
  (r.cleared ? BOSS_BONUS : 0);

/** Cards of the run deck the player may keep at the end (no basic Energy). */
export const keepableCards = (r: FrontierRun): string[] =>
  r.deck
    .map((c) => c.id)
    .filter((id) => {
      const d = registry.defs[id]!;
      return !(d.category === 'Energy' && d.energyKind === 'Basic');
    });
