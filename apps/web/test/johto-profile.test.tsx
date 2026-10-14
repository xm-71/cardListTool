import { render, screen } from '@testing-library/react';
import { GYM_DECKS } from '@ptcg/cards';
import { beforeEach, expect, test } from 'vitest';
import { opponentName } from '../src/game/describe.ts';
import { emptyGym } from '../src/game/gym.ts';
import { startGymMatch } from '../src/game/gymMatch.ts';
import { useGame } from '../src/game/store.ts';
import { deckById } from '../src/game/catalog.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { GymGameOver } from '../src/ui/GymGameOver.tsx';

const entry = { date: '2026-10-13', playerName: 'ASH', deckName: 'Deck', cover: 'me01-077' };
const unlocked = { ...emptyGym(), hallOfFame: [entry] };
const profile = () => useProfile.getState().profile;

async function init(p: Partial<Profile> = {}) {
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), playerName: 'ASH', ...p }), true);
}

beforeEach(() => {
  useProfile.getState().reset();
  useGame.getState().reset();
});

test('the first win over Falkner pays 150 credits and a me02 pack (saved), and adds the badge', async () => {
  await init({ credits: 0, gym: unlocked });
  const paid = await useProfile
    .getState()
    .recordGym({ seed: 1, leaderId: 'falkner', won: true, normalCredits: 40 });
  expect(paid).toMatchObject({ credits: 150, badge: true });
  expect(paid!.packs).toHaveLength(1);
  expect(paid!.packs[0]).toHaveLength(10);
  expect(paid!.packs[0]!.every((id) => id.startsWith('me02-'))).toBe(true);
  expect(profile().gym.badges).toEqual(['falkner']);
  expect(profile().credits).toBe(150);
});

test('Bugsy, the second Johto gym, pays 175', async () => {
  await init({ credits: 0, gym: { ...unlocked, badges: ['falkner'] } });
  const paid = await useProfile
    .getState()
    .recordGym({ seed: 2, leaderId: 'bugsy', won: true, normalCredits: 40 });
  expect(paid?.credits).toBe(175);
});

test('Chuck pays 250 credits and Clair 325, each with a me02 pack', async () => {
  const first4 = ['falkner', 'bugsy', 'whitney', 'morty'];
  await init({ credits: 0, gym: { ...unlocked, badges: first4 } });
  const chuck = await useProfile
    .getState()
    .recordGym({ seed: 10, leaderId: 'chuck', won: true, normalCredits: 40 });
  expect(chuck).toMatchObject({ credits: 250, badge: true });
  expect(chuck!.packs[0]!.every((id) => id.startsWith('me02-'))).toBe(true);
  await init({ credits: 0, gym: { ...unlocked, badges: [...first4, 'chuck', 'jasmine', 'pryce'] } });
  const clair = await useProfile
    .getState()
    .recordGym({ seed: 11, leaderId: 'clair', won: true, normalCredits: 40 });
  expect(clair).toMatchObject({ credits: 325, badge: true });
  expect(profile().gym.badges).toHaveLength(8);
});

test('a rematch win over a beaten Johto leader pays the normal credits and no pack or badge', async () => {
  await init({ credits: 0, gym: { ...unlocked, badges: ['falkner'] } });
  const rematch = await useProfile
    .getState()
    .recordGym({ seed: 3, leaderId: 'falkner', won: true, normalCredits: 40 });
  expect(rematch).toMatchObject({ credits: 40, badge: false, packs: [] });
  expect(profile().gym.badges).toEqual(['falkner']);
  expect(profile().credits).toBe(40);
});

test('a Kanto first win still opens a 151 pack', async () => {
  await init({ credits: 0 });
  const paid = await useProfile
    .getState()
    .recordGym({ seed: 4, leaderId: 'brock', won: true, normalCredits: 100 });
  expect(paid!.packs[0]!.every((id) => id.startsWith('sv03.5-'))).toBe(true);
});

test('startGymMatch starts Johto matches with the leader deck and difficulty', () => {
  const deck = deckById('mega-gengar');
  const source = { id: deck.id, name: deck.name, list: deck.list, cover: deck.cover, kind: deck.kind };
  startGymMatch('whitney', source);
  expect(useGame.getState().config).toMatchObject({
    mode: 'bot',
    difficulty: 'hard',
    botDeck: GYM_DECKS.whitney,
    context: { kind: 'gym', leaderId: 'whitney' },
  });
  startGymMatch('falkner', source);
  expect(useGame.getState().config).toMatchObject({ difficulty: 'medium', botDeck: GYM_DECKS.falkner });
});

test('the opponent is named from either region', () => {
  const config = (leaderId: string) =>
    ({ mode: 'bot', context: { kind: 'gym', leaderId } }) as Parameters<typeof opponentName>[0];
  expect(opponentName(config('falkner'), 0)).toBe('Falkner');
  expect(opponentName(config('brock'), 0)).toBe('Brock');
});

test('the Gym game over screen shows a Johto leader', () => {
  render(
    <GymGameOver
      context={{ kind: 'gym', leaderId: 'morty', deck: { kind: 'starter', id: 'mega-gengar' } }}
      result={{ winner: 0, reason: 'prizes' } as never}
      human={0}
      payout={undefined}
      onBack={() => {}}
      onRematch={() => {}}
      onNext={() => {}}
    />,
  );
  expect(screen.getByText(/Morty/)).toBeInTheDocument();
});
