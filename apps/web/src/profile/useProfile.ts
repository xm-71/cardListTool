import { create } from 'zustand';
import { GYM_SET, setCards } from '@ptcg/cards';
import { deckPrice, openPack, packPrice } from '@ptcg/economy';
import { openIndexedDbStore } from './indexedDbStore.ts';
import { createMemoryStore } from './memoryStore.ts';
import {
  abandonUnfinishedRun,
  applyEliteResult,
  applyGymResult,
  beginMatch,
  startRun,
  type Payout,
  type Region,
  type RunDeck,
} from '../game/gym.ts';
import type { EnergyType } from '@ptcg/engine';
import { DECKS, deckById, type DeckId } from '../game/catalog.ts';
import type { RunCards } from '../game/frontier/deck.ts';
import {
  abandon,
  beginFight,
  chooseStarter,
  keepableCards,
  newRun,
  payout,
  recordResult,
  skipOffer,
  takeOffer,
  type FrontierRun,
} from '../game/frontier/run.ts';
import { addToHall, type FrontierPayout } from '../game/frontier/save.ts';
import { MAX_BINDERS } from './binders.ts';
import { FALLBACK_STARTER, grantDeck, isPremadeDeck, purchaseProblem } from './ownedDecks.ts';
import { newProfile, type CustomBinder, type CustomDeck, type Profile, type ProfileStore } from './types.ts';

/** How many awarded game seeds to remember. */
const AWARD_HISTORY = 200;

/** Opens IndexedDB, falling back to an in-memory store that won't survive a reload. */
export async function connectProfileStore(
  open: () => Promise<ProfileStore> = () => openIndexedDbStore(),
): Promise<{ store: ProfileStore; persistent: boolean }> {
  try {
    const store = await open();
    await store.load();
    return { store, persistent: true };
  } catch {
    return { store: createMemoryStore(), persistent: false };
  }
}

export const MAX_NAME = 10;

/** What a gym or Elite Four result paid: credits and the contents of each reward pack (already saved). */
export interface GymPayout {
  credits: number;
  packs: string[][];
  /** The first win over a gym: it earned its badge. */
  badge: boolean;
  /** The Champion was beaten and a Hall of Fame entry was added. */
  champion: boolean;
  /** The set the reward packs came from; the 151 set when absent. */
  set?: string;
  /** False when an Elite Four result arrived for a stage the run had already moved past (another tab). */
  counted?: boolean;
}

/** Opens `n` free packs of `set` (the 151 set by default) into `collection`, returning each pack's cards. */
function openRewardPacks(n: number, collection: Record<string, number>, set: string = GYM_SET): string[][] {
  const packs: string[][] = [];
  for (let i = 0; i < n; i++) {
    const { cards } = openPack(set, setCards(set), randomSeed());
    for (const id of cards) collection[id] = (collection[id] ?? 0) + 1;
    packs.push(cards);
  }
  return packs;
}

function pay(
  p: Profile,
  payout: Payout | null,
): { collection: Record<string, number>; credits: number; packs: string[][]; set?: string } {
  const collection = { ...p.collection };
  const packs = payout ? openRewardPacks(payout.packs, collection, payout.set) : [];
  return {
    collection,
    credits: p.credits + (payout?.credits ?? 0),
    packs,
    ...(payout?.set ? { set: payout.set } : {}),
  };
}

/** Trimmed, at most 10 characters, and "PLAYER" when empty. */
function cleanName(name: string): string {
  return name.trim().slice(0, MAX_NAME) || 'PLAYER';
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

interface ProfileState {
  profile: Profile;
  persistent: boolean;
  ready: boolean;
  store: ProfileStore;
  init(store: ProfileStore, persistent: boolean): Promise<void>;
  /** Adds credits for a finished bot game, once per game seed. */
  award(seed: number, amount: number): Promise<void>;
  /** Pays for and opens a pack; the cards are saved before this resolves. */
  buyPack(setId: string): Promise<string[]>;
  /** Pays for a premade deck and adds it, with its 60 cards, in one save. Rejects when `purchaseProblem` says so. */
  buyDeck(id: string): Promise<void>;
  /**
   * Records a finished gym match, once per game seed. A first win over the next gym pays its badge reward
   * (credits and a 151 pack, saved here); anything else pays `normalCredits`. Resolves to what was paid.
   */
  recordGym(o: {
    seed: number;
    leaderId: string;
    won: boolean;
    normalCredits: number;
  }): Promise<GymPayout | undefined>;
  /** Records a finished Elite Four or Champion match, once per game seed (`draw`: the match is replayed). */
  recordElite(o: {
    seed: number;
    stage: number;
    /** The match's region; Kanto when absent. */
    region?: Region;
    won: boolean;
    draw?: boolean;
    deckName: string;
    cover: string;
  }): Promise<GymPayout | undefined>;
  /** Starts an Elite Four run with a locked deck (needs all 8 badges of the region; Kanto by default). */
  startEliteRun(deck: RunDeck, region?: Region): Promise<void>;
  /** An Elite Four or Champion match is starting: leaving it before it ends will count as a loss. */
  beginEliteMatch(stage: number, region?: Region): Promise<boolean>;
  /** Ends a run whose match was started but never finished (the player quit or reloaded). */
  abandonUnfinishedRun(): Promise<void>;
  /** Starts a Battle Frontier run (does nothing while a run, even a finished unclaimed one, exists). */
  startFrontierRun(): Promise<void>;
  chooseFrontierStarter(id: string): Promise<void>;
  /**
   * A Frontier fight with game seed `seed` is starting: leaving it before it ends will count as a loss. Resolves to the
   * saved run when this call began the fight, or null when it could not (a fight already in progress, or no fight).
   */
  beginFrontierMatch(seed: number): Promise<FrontierRun | null>;
  /**
   * Records a finished Frontier fight once per game seed, and only for the run's current fight while it is in
   * progress (a result from another tab for a fight the run has left is ignored).
   */
  recordFrontier(o: {
    seed: number;
    fight: number;
    won: boolean;
    draw: boolean;
  }): Promise<FrontierPayout | undefined>;
  takeFrontierOffer(index: number, cut: RunCards, energyTypes?: EnergyType[]): Promise<void>;
  skipFrontierOffer(): Promise<void>;
  /** Ends the run as a loss; it is claimed (and paid) with `endFrontierRun`. */
  abandonFrontierRun(): Promise<void>;
  /** Claims a finished run: pays its credits, adds the kept card, records a clear in the Hall of Fame. */
  endFrontierRun(keepCardId: string | null): Promise<{ credits: number } | undefined>;
  /** A Frontier fight that was started but never recorded (quit or reload) counts as a loss. */
  settleUnfinishedFrontierMatch(): Promise<void>;
  saveDeck(deck: CustomDeck): Promise<void>;
  deleteDeck(id: string): Promise<void>;
  /** Ends the intro. An empty name or a null deck keeps what the profile already has (else PLAYER / Mega Gengar). */
  finishIntro(name: string, deck: string | null): Promise<void>;
  /** Makes an owned premade deck or an existing custom deck (`custom:<id>`) the active deck; other ids are ignored. */
  setActiveDeck(id: string): Promise<void>;
  setName(name: string): Promise<void>;
  /** Adds or replaces a binder by id (stamping updatedAt); a new one is refused at MAX_BINDERS. */
  saveBinder(b: CustomBinder): Promise<void>;
  /**
   * Applies an edit to the stored copy of a binder (so edits made in another tab are kept);
   * does nothing if the binder no longer exists or the edit changes nothing.
   */
  updateBinder(
    id: string,
    edit: (b: CustomBinder, collection: Readonly<Record<string, number>>) => CustomBinder,
  ): Promise<void>;
  deleteBinder(id: string): Promise<void>;
  /** Collector mode: packs are free and battling is hidden. Credits are kept as they are. */
  setCollectorMode(on: boolean): Promise<void>;
  replayIntro(): Promise<void>;
  reset(): void;
}

/** Resolves once `init` has loaded the real profile; recreated by `reset`. */
function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

export const useProfile = create<ProfileState>()((set, get) => {
  let loaded = deferred();
  let queue: Promise<unknown> = Promise.resolve();
  /**
   * Runs one change at a time: waits for the profile to load, re-reads the stored profile (another tab may
   * have changed it), saves the result, and only then shows it. A change that throws or fails to save
   * leaves both storage and the screen as they were.
   */
  const change = <T>(fn: (p: Profile) => { next: Profile; result: T } | null): Promise<T | undefined> => {
    const run = queue.then(async () => {
      await loaded.promise;
      const { store } = get();
      const outcome = fn(await store.load());
      if (!outcome) return undefined;
      await store.save(outcome.next);
      set({ profile: outcome.next });
      return outcome.result;
    });
    queue = run.catch(() => undefined);
    return run;
  };
  /** Applies `fn` to the saved Frontier run (no-op when there is none or `fn` returns null). */
  const changeRun = (fn: (r: FrontierRun) => FrontierRun | null) =>
    change((p) => {
      const r = p.frontier.run;
      const next = r ? fn(r) : null;
      return next ? { next: { ...p, frontier: { ...p.frontier, run: next } }, result: undefined } : null;
    });
  return {
    profile: newProfile(),
    persistent: false,
    ready: false,
    store: createMemoryStore(),
    async init(store, persistent) {
      const profile = await store.load();
      set({ store, persistent, profile, ready: true });
      loaded.resolve();
    },
    async award(seed, amount) {
      await change((p) =>
        p.awardedGames.includes(seed)
          ? null
          : {
              next: {
                ...p,
                credits: p.credits + amount,
                awardedGames: [...p.awardedGames, seed].slice(-AWARD_HISTORY),
              },
              result: undefined,
            },
      );
    },
    async buyPack(setId) {
      const cards = await change((p) => {
        const price = p.collectorMode ? 0 : packPrice(setId);
        if (p.credits < price) throw new Error('Not enough credits');
        const { cards } = openPack(setId, setCards(setId), randomSeed());
        const collection = { ...p.collection };
        for (const id of cards) collection[id] = (collection[id] ?? 0) + 1;
        return { next: { ...p, credits: p.credits - price, collection }, result: cards };
      });
      return cards!;
    },
    async buyDeck(id) {
      await change((p) => {
        const problem = purchaseProblem(p, id);
        if (problem) throw new Error(problem);
        const deck = deckById(id as DeckId);
        const granted = grantDeck(p, deck.id);
        return { next: { ...granted, credits: p.credits - deckPrice(deck.kind) }, result: undefined };
      });
    },
    async recordGym({ seed, leaderId, won, normalCredits }) {
      return change((p) => {
        if (p.awardedGames.includes(seed)) return null;
        const { next: gym, reward } = applyGymResult(p.gym, leaderId, won);
        const paid = pay(p, reward);
        const credits = reward ? paid.credits : p.credits + normalCredits;
        return {
          next: {
            ...p,
            gym,
            collection: paid.collection,
            credits,
            awardedGames: [...p.awardedGames, seed].slice(-AWARD_HISTORY),
          },
          result: {
            credits: reward ? reward.credits : normalCredits,
            packs: paid.packs,
            ...(paid.set ? { set: paid.set } : {}),
            badge: !!reward,
            champion: false,
          },
        };
      });
    },
    async recordElite({ seed, stage, region, won, draw, deckName, cover }) {
      return change((p) => {
        if (p.awardedGames.includes(seed)) return null;
        const entry = {
          date: new Date().toISOString().slice(0, 10),
          playerName: p.playerName ?? 'PLAYER',
          deckName,
          cover,
        };
        const {
          next: gym,
          reward,
          stale,
        } = applyEliteResult(p.gym, stage, won, entry, draw, region ?? 'kanto');
        const paid = pay(p, reward);
        return {
          next: {
            ...p,
            gym,
            collection: paid.collection,
            credits: paid.credits,
            awardedGames: [...p.awardedGames, seed].slice(-AWARD_HISTORY),
          },
          result: {
            credits: reward?.credits ?? 0,
            packs: paid.packs,
            ...(paid.set ? { set: paid.set } : {}),
            badge: false,
            champion: !!reward,
            counted: !stale,
          },
        };
      });
    },
    async startEliteRun(deck, region) {
      await change((p) => {
        const gym = startRun(p.gym, deck, region);
        return gym === p.gym ? null : { next: { ...p, gym }, result: undefined };
      });
    },
    async beginEliteMatch(stage, region = 'kanto') {
      const marked = await change((p) => {
        const gym = beginMatch(p.gym, stage, region);
        const ours = !!gym.run && gym.run.stage === stage && (gym.run.region ?? 'kanto') === region;
        return { next: gym === p.gym ? p : { ...p, gym }, result: ours };
      });
      return marked === true;
    },
    async startFrontierRun() {
      await change((p) =>
        p.frontier.run
          ? null
          : { next: { ...p, frontier: { ...p.frontier, run: newRun(randomSeed()) } }, result: undefined },
      );
    },
    async chooseFrontierStarter(id) {
      await changeRun((r) => (r.phase === 'starter' ? chooseStarter(r, id) : null));
    },
    async beginFrontierMatch(seed) {
      const began = await change((p) => {
        const r = p.frontier.run;
        if (!r || r.phase !== 'hub' || r.inMatch) return null;
        const run = beginFight(r, seed);
        return { next: { ...p, frontier: { ...p.frontier, run } }, result: run };
      });
      return began ?? null;
    },
    async recordFrontier({ seed, fight, won, draw }) {
      const outcome = draw ? 'draw' : won ? 'win' : 'loss';
      return change((p) => {
        const r = p.frontier.run;
        if (p.awardedGames.includes(seed)) return null;
        const awardedGames = [...p.awardedGames, seed].slice(-AWARD_HISTORY);
        if (!r || r.phase !== 'hub' || !r.inMatch || r.fight !== fight || r.matchSeed !== seed) {
          const stale: FrontierPayout = {
            counted: false,
            outcome,
            lives: r?.lives ?? 0,
            phase: r?.phase ?? 'over',
          };
          return { next: { ...p, awardedGames }, result: stale };
        }
        const run = recordResult(r, outcome);
        return {
          next: { ...p, awardedGames, frontier: { ...p.frontier, run } },
          result: { counted: true, outcome, lives: run.lives, phase: run.phase },
        };
      });
    },
    async takeFrontierOffer(index, cut, energyTypes) {
      await changeRun((r) => takeOffer(r, index, cut, energyTypes));
    },
    async skipFrontierOffer() {
      await changeRun((r) => skipOffer(r));
    },
    async abandonFrontierRun() {
      await changeRun((r) => (r.phase === 'over' ? null : abandon(r)));
    },
    async endFrontierRun(keepCardId) {
      return change((p) => {
        const r = p.frontier.run;
        if (!r || r.phase !== 'over') return null;
        const credits = payout(r);
        const collection = { ...p.collection };
        if (keepCardId && keepableCards(r).includes(keepCardId))
          collection[keepCardId] = (collection[keepCardId] ?? 0) + 1;
        const hallOfFame = r.cleared
          ? addToHall(p.frontier.hallOfFame, {
              date: new Date().toISOString().slice(0, 10),
              playerName: p.playerName ?? 'PLAYER',
              deckName: DECKS.find((d) => d.id === r.starterId)?.name ?? 'Frontier deck',
              cover: r.cover,
              livesLeft: r.lives,
            })
          : p.frontier.hallOfFame;
        return {
          next: { ...p, credits: p.credits + credits, collection, frontier: { run: null, hallOfFame } },
          result: { credits },
        };
      });
    },
    async settleUnfinishedFrontierMatch() {
      await changeRun((r) => (r.phase === 'hub' && r.inMatch ? recordResult(r, 'loss') : null));
    },
    async abandonUnfinishedRun() {
      await change((p) => {
        const gym = abandonUnfinishedRun(p.gym);
        return gym === p.gym ? null : { next: { ...p, gym }, result: undefined };
      });
    },
    async saveDeck(deck) {
      await change((p) => {
        const exists = p.decks.some((d) => d.id === deck.id);
        const decks = exists ? p.decks.map((d) => (d.id === deck.id ? deck : d)) : [...p.decks, deck];
        return { next: { ...p, decks }, result: undefined };
      });
    },
    async deleteDeck(id) {
      await change((p) => ({ next: { ...p, decks: p.decks.filter((d) => d.id !== id) }, result: undefined }));
    },
    async finishIntro(name, deck) {
      await change((p) => {
        const first = p.ownedDecks.length === 0;
        const picked = deck ?? p.starterDeck ?? FALLBACK_STARTER;
        // The first intro gives the starter deck and its cards. Replaying it can only change the default deck to one
        // the player owns, so the Trainer Card and the deck lists never disagree.
        const starterDeck = first
          ? isPremadeDeck(picked)
            ? picked
            : FALLBACK_STARTER
          : p.ownedDecks.includes(picked)
            ? picked
            : (p.starterDeck ?? p.ownedDecks[0]!);
        const next = {
          ...p,
          playerName: name.trim() ? cleanName(name) : (p.playerName ?? 'PLAYER'),
          starterDeck,
          activeDeck: first ? starterDeck : p.activeDeck,
          introDone: true,
        };
        return { next: first ? grantDeck(next, starterDeck as DeckId) : next, result: undefined };
      });
    },
    async setActiveDeck(id) {
      await change((p) => {
        const ok = id.startsWith('custom:')
          ? p.decks.some((d) => `custom:${d.id}` === id)
          : p.ownedDecks.includes(id);
        return ok ? { next: { ...p, activeDeck: id }, result: undefined } : null;
      });
    },
    async saveBinder(binder) {
      await change((p) => {
        const exists = p.binders.some((b) => b.id === binder.id);
        if (!exists && p.binders.length >= MAX_BINDERS) return null;
        const saved = { ...binder, updatedAt: Date.now() };
        const binders = exists
          ? p.binders.map((b) => (b.id === binder.id ? saved : b))
          : [...p.binders, saved];
        return { next: { ...p, binders }, result: undefined };
      });
    },
    async updateBinder(id, edit) {
      await change((p) => {
        const current = p.binders.find((b) => b.id === id);
        if (!current) return null;
        const next = edit(current, p.collection);
        if (next === current) return null;
        const saved = { ...next, id, updatedAt: Date.now() };
        return {
          next: { ...p, binders: p.binders.map((b) => (b.id === id ? saved : b)) },
          result: undefined,
        };
      });
    },
    async deleteBinder(id) {
      await change((p) => ({
        next: { ...p, binders: p.binders.filter((b) => b.id !== id) },
        result: undefined,
      }));
    },
    async setCollectorMode(on) {
      await change((p) => ({ next: { ...p, collectorMode: on }, result: undefined }));
    },
    async setName(name) {
      await change((p) => ({ next: { ...p, playerName: cleanName(name) }, result: undefined }));
    },
    async replayIntro() {
      await change((p) => ({ next: { ...p, introDone: false }, result: undefined }));
    },
    reset() {
      loaded = deferred();
      queue = Promise.resolve();
      set({ profile: newProfile(), persistent: false, ready: false, store: createMemoryStore() });
    },
  };
});
