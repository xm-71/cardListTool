import { CREDITS } from '@ptcg/economy';
import type { Route } from '../nav/useNav.ts';
import type { CustomBinder, Profile } from '../profile/types.ts';
import { FIGHTS, LIVES } from './frontier/run.ts';
import { LEADERS, nextGymIndex } from './gym.ts';

/** The main menu's town square: eight buildings around a fountain. Everything here is pure. */

export type BuildingId = 'duel' | 'gym' | 'frontier' | 'shop' | 'binder' | 'decks' | 'options' | 'house';

export interface Building {
  id: BuildingId;
  /** Where entering it goes (My House opens the Trainer Card instead). */
  route: Route | null;
  /** The menu item's name: the old menu's labels, so it reads the same to screen readers. */
  label: string;
  /** The sign over the door. */
  sign: string;
  row: number;
  col: number;
  /** A battling building: closed in Collector mode. */
  battle: boolean;
  /** Roof colour (a fixed accent: buildings look the same in both themes). */
  roof: string;
}

/** In the old menu's order (the order they're read out), then My House. */
export const BUILDINGS: readonly Building[] = [
  { id: 'duel', route: 'duel', label: 'Duel', sign: 'Duel Hall', row: 1, col: 2, battle: true, roof: '#d84848' },
  { id: 'gym', route: 'gym', label: 'Gym Challenge', sign: 'Gym', row: 0, col: 1, battle: true, roof: '#3868c0' },
  {
    id: 'frontier',
    route: 'frontier',
    label: 'Battle Frontier',
    sign: 'Frontier',
    row: 0,
    col: 2,
    battle: true,
    roof: '#8060c0',
  },
  { id: 'shop', route: 'shop', label: 'Shop', sign: 'Poké Mart', row: 1, col: 0, battle: false, roof: '#58a0d8' },
  { id: 'binder', route: 'binder', label: 'Binder', sign: 'Binder', row: 2, col: 1, battle: false, roof: '#58a050' },
  { id: 'decks', route: 'decks', label: 'Decks', sign: 'Deck Lab', row: 2, col: 0, battle: true, roof: '#e890b8' },
  {
    id: 'options',
    route: 'options',
    label: 'Options',
    sign: 'Options',
    row: 2,
    col: 2,
    battle: false,
    roof: '#a8a8a8',
  },
  { id: 'house', route: null, label: 'My House', sign: 'My House', row: 0, col: 0, battle: false, roof: '#f0c030' },
];

const STEP: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * The building an arrow key moves to: the nearest open one in that direction, walking past the fountain and
 * closed buildings. Stays put at the edge of the square.
 */
export function moveInTown(from: BuildingId, key: string, open: (id: BuildingId) => boolean): BuildingId {
  const step = STEP[key];
  const at = BUILDINGS.find((b) => b.id === from);
  if (!step || !at) return from;
  for (let r = at.row + step[0], c = at.col + step[1]; r >= 0 && r < 3 && c >= 0 && c < 3; r += step[0], c += step[1]) {
    const b = BUILDINGS.find((x) => x.row === r && x.col === c);
    if (b && open(b.id)) return b.id;
  }
  return from;
}

export interface TownStatus {
  /** Gym badges earned (0-8). */
  badges: number;
  /** The Elite Four and Champion have been beaten at least once. */
  champion: boolean;
  /** The Frontier run in progress (fight is the next one, 0-based), or null. */
  frontier: { fight: number; wins: number; lives: number } | null;
  /** Show the Mart's NEW sign: a pack is affordable (packs are free in Collector mode, so no sign there). */
  canBuyPack: boolean;
  /** Different cards owned. */
  owned: number;
}

export function townStatus(p: Profile): TownStatus {
  const run = p.frontier.run;
  return {
    badges: LEADERS.filter((l) => p.gym.badges.includes(l.id)).length,
    champion: p.gym.hallOfFame.length > 0,
    frontier: run && run.phase !== 'over' ? { fight: run.fight, wins: run.wins, lives: run.lives } : null,
    canBuyPack: !p.collectorMode && p.credits >= CREDITS.packPrice,
    owned: Object.values(p.collection).filter((n) => n > 0).length,
  };
}

/** The binder edited most recently, or null. */
export const latestBinder = (p: Profile): CustomBinder | null =>
  p.binders.reduce<CustomBinder | null>((a, b) => (!a || b.updatedAt > a.updatedAt ? b : a), null);

/** The dialog box line for the building the cursor is on. `tip` is the tip of the day, delivered to My House. */
export function describeBuilding(id: BuildingId, p: Profile, tip: string): string {
  const b = BUILDINGS.find((x) => x.id === id)!;
  if (p.collectorMode && b.battle) return 'Closed while Collector mode is on.';
  const s = townStatus(p);
  switch (id) {
    case 'duel':
      return 'One game against a bot. Medium and Hard bots pay more credits.';
    case 'gym': {
      const next = LEADERS[nextGymIndex(p.gym.badges)];
      if (!next)
        return s.champion
          ? 'Champion! Rematch the Elite Four any time.'
          : `All ${LEADERS.length} badges! The Elite Four are waiting.`;
      return `${s.badges} of ${LEADERS.length} badges. Next up: ${next.name}, ${next.type} type.`;
    }
    case 'frontier':
      return s.frontier
        ? `Run in progress: fight ${s.frontier.fight + 1} of ${FIGHTS}, ${s.frontier.lives} ${s.frontier.lives === 1 ? 'life' : 'lives'} left.`
        : `${FIGHTS} fights, ${LIVES} lives. Build your deck as you go.`;
    case 'shop':
      return p.collectorMode
        ? 'Packs are free in Collector mode.'
        : `Packs cost ${CREDITS.packPrice} credits. You have ${p.credits.toLocaleString('en-US')}.`;
    case 'binder': {
      const owned = `Your collection: ${s.owned} different ${s.owned === 1 ? 'card' : 'cards'}.`;
      const latest = latestBinder(p);
      return latest ? `${owned} Latest binder: ${latest.name}.` : owned;
    }
    case 'decks':
      return 'Build and edit your decks.';
    case 'options':
      return 'Sound, theme, animations and your name.';
    case 'house':
      return tip ? `Your Trainer Card. Mail: ${tip}` : 'Your Trainer Card.';
  }
}
