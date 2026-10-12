import { DECKS, registry } from '../catalog.ts';
import { LEADERS } from '../gym.ts';
import { FIGHTS, LIVES, type FrontierRun } from './run.ts';
import type { FrontierOpponent } from './opponents.ts';
import type { Offer } from './offers.ts';

/** A cleared run, for the Frontier Hall of Fame. */
export interface FrontierHallEntry {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  playerName: string;
  deckName: string;
  cover: string;
  livesLeft: number;
}

export interface FrontierProgress {
  run: FrontierRun | null;
  /** Newest first. */
  hallOfFame: FrontierHallEntry[];
}

/** What a recorded Frontier fight did to the run. */
export interface FrontierPayout {
  /** False when the result was ignored (already recorded, or for a fight the run had left). */
  counted: boolean;
  outcome: 'win' | 'loss' | 'draw';
  lives: number;
  phase: FrontierRun['phase'];
}

export const HALL_OF_FAME_SIZE = 20;

export const emptyFrontier = (): FrontierProgress => ({ run: null, hallOfFame: [] });

const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isString = (v: unknown): v is string => typeof v === 'string';
const isCards = (v: unknown): v is { id: string; count: number }[] =>
  Array.isArray(v) &&
  v.every((c) => !!c && isString(c.id) && registry.defs[c.id] !== undefined && isInt(c.count, 1, 60));
const deckIds = new Set<string>(DECKS.map((d) => d.id));
const leaderIds = new Set<string>(LEADERS.map((l) => l.id));

function isOpponent(o: unknown): o is FrontierOpponent {
  const x = o as Partial<FrontierOpponent> | null;
  return (
    !!x &&
    (x.source === 'catalog'
      ? deckIds.has(x.id as string)
      : x.source === 'gym' && leaderIds.has(x.id as string)) &&
    isString(x.name) &&
    isString(x.type) &&
    isString(x.cover) &&
    (x.difficulty === 'easy' || x.difficulty === 'medium' || x.difficulty === 'hard') &&
    (x.brain === undefined || isString(x.brain))
  );
}

function isOffer(o: unknown): o is Offer {
  const x = o as { kind?: unknown; pkg?: { id?: unknown; cards?: unknown } } | null;
  return (
    !!x &&
    (x.kind === 'tuneup' || (x.kind === 'package' && !!x.pkg && isString(x.pkg.id) && isCards(x.pkg.cards)))
  );
}

/** The run as saved, or null when anything about it is off (an old or broken save never crashes the app). */
function normalizeRun(raw: unknown): FrontierRun | null {
  const r = raw as Partial<FrontierRun> | null;
  if (!r || typeof r !== 'object') return null;
  const phases = ['starter', 'hub', 'reward', 'over'];
  const ok =
    isInt(r.seed, 0, 2 ** 32) &&
    phases.includes(r.phase as string) &&
    Array.isArray(r.starterChoices) &&
    r.starterChoices.every((id) => deckIds.has(id)) &&
    (r.starterId === null || (isString(r.starterId) && deckIds.has(r.starterId))) &&
    isInt(r.fight, 0, FIGHTS - 1) &&
    isInt(r.lives, 0, LIVES) &&
    isInt(r.wins, 0, FIGHTS) &&
    isCards(r.deck) &&
    isString(r.cover) &&
    Array.isArray(r.opponents) &&
    (r.phase === 'starter' ? r.opponents.length === 0 : r.opponents.length === FIGHTS) &&
    r.opponents.every(isOpponent) &&
    (r.offers === null || (Array.isArray(r.offers) && r.offers.every(isOffer))) &&
    (r.phase !== 'reward' || (Array.isArray(r.offers) && r.offers.length > 0));
  if (!ok) return null;
  return {
    seed: r.seed!,
    phase: r.phase!,
    starterChoices: [...r.starterChoices!],
    starterId: r.starterId ?? null,
    fight: r.fight!,
    lives: r.lives!,
    wins: r.wins!,
    deck: r.deck!.map((c) => ({ id: c.id, count: c.count })),
    cover: r.cover!,
    opponents: r.opponents!.map((o) => ({ ...o })),
    offers: r.offers ? r.offers.map((o) => structuredClone(o)) : null,
    ...(r.inMatch === true ? { inMatch: true } : {}),
    ...(r.cleared === true ? { cleared: true } : {}),
  };
}

/** Fills or repairs the Frontier part of a saved profile. */
export function normalizeFrontier(raw: unknown): FrontierProgress {
  const f = (raw ?? {}) as Partial<Record<keyof FrontierProgress, unknown>>;
  const hallOfFame = Array.isArray(f.hallOfFame)
    ? f.hallOfFame
        .filter(
          (e): e is FrontierHallEntry =>
            !!e &&
            isString(e.date) &&
            isString(e.playerName) &&
            isString(e.deckName) &&
            isString(e.cover) &&
            isInt(e.livesLeft, 0, LIVES),
        )
        .slice(0, HALL_OF_FAME_SIZE)
    : [];
  return { run: normalizeRun(f.run), hallOfFame };
}

/** Adds a cleared run to the Hall of Fame (newest first, capped). */
export const addToHall = (hall: FrontierHallEntry[], entry: FrontierHallEntry): FrontierHallEntry[] =>
  [entry, ...hall].slice(0, HALL_OF_FAME_SIZE);
