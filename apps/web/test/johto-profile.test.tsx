import { render, screen } from '@testing-library/react';
import { GYM_DECKS } from '@ptcg/cards';
import { beforeEach, expect, test } from 'vitest';
import { opponentName } from '../src/game/describe.ts';
import { emptyGym } from '../src/game/gym.ts';
import { startEliteMatch, startGymMatch } from '../src/game/gymMatch.ts';
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

// ---- Johto Elite Four ----
const JOHTO = ['falkner', 'bugsy', 'whitney', 'morty', 'chuck', 'jasmine', 'pryce', 'clair'];
const KANTO = ['brock', 'misty', 'surge', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni'];
const runDeck = {
  kind: 'starter' as const,
  id: 'mega-gengar',
  name: 'Gengar',
  cover: 'me02-056',
  cards: [{ id: 'mee-007', count: 60 }],
};
const johtoGym = () => ({ ...emptyGym(), badges: [...KANTO, ...JOHTO], hallOfFame: [entry] });
const sourceOf = () => {
  const d = deckById('mega-gengar');
  return { id: d.id, name: d.name, list: d.list, cover: d.cover, kind: d.kind };
};

test('startEliteRun with a Johto deck stores region johto and refuses while a Kanto run exists', async () => {
  await init({ gym: johtoGym() });
  await useProfile.getState().startEliteRun(runDeck, 'johto');
  expect(profile().gym.run).toEqual({ stage: 0, region: 'johto', deck: runDeck });
  await init({ gym: { ...johtoGym(), run: { stage: 2, deck: runDeck } } });
  await useProfile.getState().startEliteRun(runDeck, 'johto');
  expect(profile().gym.run).toEqual({ stage: 2, deck: runDeck });
});

test('beginEliteMatch then abandonUnfinishedRun ends a Johto run', async () => {
  await init({ gym: { ...johtoGym(), run: { stage: 1, region: 'johto', deck: runDeck } } });
  await useProfile.getState().beginEliteMatch(1);
  expect(profile().gym.run?.inMatch).toBe(true);
  await useProfile.getState().abandonUnfinishedRun();
  expect(profile().gym.run).toBeNull();
});

test('beating Lance adds a Johto entry and pays 1500 credits and 3 me02 packs, then 400 and 1', async () => {
  await init({ credits: 0, gym: { ...johtoGym(), run: { stage: 4, region: 'johto', deck: runDeck } } });
  const first = await useProfile
    .getState()
    .recordElite({
      seed: 20,
      stage: 4,
      region: 'johto',
      won: true,
      draw: false,
      deckName: 'Gengar',
      cover: 'me02-056',
    });
  expect(first).toMatchObject({ credits: 1500, champion: true, counted: true });
  expect(first!.packs).toHaveLength(3);
  expect(first!.set).toBe('me02');
  expect(first!.packs.flat().every((id) => id.startsWith('me02-'))).toBe(true);
  expect(profile().credits).toBe(1500);
  expect(profile().gym.run).toBeNull();
  expect(profile().gym.hallOfFame[0]).toMatchObject({ region: 'johto', deckName: 'Gengar' });
  await init({
    credits: 0,
    gym: {
      ...johtoGym(),
      hallOfFame: [{ ...entry, region: 'johto' }, entry],
      run: { stage: 4, region: 'johto', deck: runDeck },
    },
  });
  const again = await useProfile
    .getState()
    .recordElite({
      seed: 21,
      stage: 4,
      region: 'johto',
      won: true,
      draw: false,
      deckName: 'Gengar',
      cover: 'me02-056',
    });
  expect(again).toMatchObject({ credits: 400 });
  expect(again!.packs).toHaveLength(1);
});

test('a Johto result against a Kanto run counts for nothing; a Kanto Champion win is unchanged', async () => {
  await init({ credits: 0, gym: { ...johtoGym(), run: { stage: 4, deck: runDeck } } });
  const stale = await useProfile
    .getState()
    .recordElite({
      seed: 22,
      stage: 4,
      region: 'johto',
      won: true,
      draw: false,
      deckName: 'D',
      cover: 'me02-056',
    });
  expect(stale).toMatchObject({ counted: false, credits: 0 });
  expect(profile().gym.run).toEqual({ stage: 4, deck: runDeck });
  const kanto = await useProfile
    .getState()
    .recordElite({ seed: 23, stage: 4, won: true, draw: false, deckName: 'D', cover: 'me02-056' });
  expect(kanto).toMatchObject({ credits: 300, champion: true });
  expect(kanto!.packs[0]!.every((id) => id.startsWith('sv03.5-'))).toBe(true);
});

test('startEliteMatch plays the Johto opponent, and Lance always plays his fixed deck', async () => {
  await init({ gym: { ...johtoGym(), run: { stage: 0, region: 'johto', deck: runDeck } } });
  await startEliteMatch(0, sourceOf(), 'johto');
  expect(useGame.getState().config).toMatchObject({
    difficulty: 'hard',
    botDeck: GYM_DECKS.will,
    context: { kind: 'elite', stage: 0, region: 'johto' },
  });
  await init({ gym: { ...johtoGym(), run: { stage: 4, region: 'johto', deck: runDeck } } });
  await startEliteMatch(4, sourceOf(), 'johto');
  expect(useGame.getState().config).toMatchObject({ botDeck: GYM_DECKS['johto-lance'] });
  await init({ gym: { ...emptyGym(), badges: KANTO, run: { stage: 4, deck: runDeck } } });
  await startEliteMatch(4, sourceOf());
  expect(useGame.getState().config?.context).toEqual({
    kind: 'elite',
    stage: 4,
    deckName: sourceOf().name,
    cover: sourceOf().cover,
  });
});

test('the opponent is named from the Johto Elite Four', () => {
  const config = (stage: number, region?: 'johto') =>
    ({ mode: 'bot', context: { kind: 'elite', stage, region, deckName: 'D', cover: 'c' } }) as Parameters<
      typeof opponentName
    >[0];
  expect(opponentName(config(1, 'johto'), 0)).toBe('Koga');
  expect(opponentName(config(1), 0)).toBe('Bruno');
  expect(opponentName(config(4, 'johto'), 0)).toBe('Champion Lance');
});

const elite = (stage: number, region?: 'johto') =>
  ({ kind: 'elite', stage, region, deckName: 'D', cover: 'c' }) as const;
const gameOver = (
  context: Parameters<typeof GymGameOver>[0]['context'],
  payout: Parameters<typeof GymGameOver>[0]['payout'],
  onNext = () => {},
) =>
  render(
    <GymGameOver
      context={context}
      result={{ winner: 0, reason: 'prizes' } as never}
      human={0}
      payout={payout}
      onBack={() => {}}
      onRematch={() => {}}
      onNext={onNext}
    />,
  );

test('after beating Will the game over screen offers Next: Koga', () => {
  gameOver(elite(0, 'johto'), { credits: 0, packs: [], badge: false, champion: false, counted: true });
  expect(screen.getByRole('button', { name: 'Next: Koga' })).toBeInTheDocument();
  expect(screen.getByText(/Will:/)).toBeInTheDocument();
});

test('after beating Lance the screen says Champion! and offers the Mega Evolution packs', () => {
  gameOver(elite(4, 'johto'), {
    credits: 1500,
    packs: [['me02-001'], ['me02-002'], ['me02-003']],
    set: 'me02',
    badge: false,
    champion: true,
    counted: true,
  });
  expect(screen.getByRole('heading', { name: 'Champion!' })).toBeInTheDocument();
  expect(screen.getByText('You won 3 Mega Evolution packs!')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Next/ })).toBeNull();
});

test('a Kanto pack reward keeps the 151 wording', () => {
  gameOver(
    { kind: 'gym', leaderId: 'brock', deck: { kind: 'starter', id: 'x' } },
    { credits: 100, packs: [['sv03.5-001']], badge: true, champion: false },
  );
  expect(screen.getByText('You won a Scarlet & Violet 151 pack!')).toBeInTheDocument();
});

test('a Johto badge pack says Mega Evolution too', () => {
  gameOver(
    { kind: 'gym', leaderId: 'falkner', deck: { kind: 'starter', id: 'x' } },
    { credits: 150, packs: [['me02-001']], set: 'me02', badge: true, champion: false },
  );
  expect(screen.getByText('You won a Mega Evolution pack!')).toBeInTheDocument();
});
