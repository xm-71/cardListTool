import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';
import { setCards } from '@ptcg/cards';
import { App } from '../src/App.tsx';
import { useGame } from '../src/game/store.ts';
import { useNav } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type Profile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { Binder } from '../src/screens/Binder.tsx';
import { DeckBuilder } from '../src/screens/DeckBuilder.tsx';
import { Shop } from '../src/screens/Shop.tsx';
import { useSettings } from '../src/settings/useSettings.ts';
import { PackArt } from '../src/ui/pack/PackArt.tsx';

const charizard = 'base1-4';
const vanilla = setCards('base1').find(
  (c) => c.category === 'Pokemon' && c.abilities.length === 0 && c.attacks.every((a) => a.text === ''),
)!;

async function withProfile(p: Partial<Profile> = {}) {
  useGame.getState().reset();
  useProfile.getState().reset();
  await useProfile.getState().init(createMemoryStore({ ...newProfile(), ...p }), true);
}

beforeEach(() => {
  useSettings.setState({ sound: false, skipTitle: false });
});

test('a pack shows its set logo, and the set name if the logo fails to load', () => {
  render(<PackArt setId="base1" name="Base Set" />);
  const logo = screen.getByRole('img', { name: 'Base Set logo' });
  expect(logo).toHaveAttribute('src', 'https://assets.tcgdex.net/en/base/base1/logo.webp');
  fireEvent.error(logo);
  expect(screen.queryByRole('img', { name: 'Base Set logo' })).not.toBeInTheDocument();
  expect(screen.getByText('BASE SET')).toBeInTheDocument();
});

test('the shop groups packs by era and sells all 12 classic sets', async () => {
  await withProfile();
  render(<Shop />);
  const mega = screen.getByRole('region', { name: 'Mega Evolution era' });
  const classic = screen.getByRole('region', { name: 'Classic' });
  expect(within(mega).getAllByRole('button', { name: 'Buy & open' })).toHaveLength(2);
  expect(within(classic).getAllByRole('button', { name: 'Buy & open' })).toHaveLength(12);
  for (const name of [
    'Base Set',
    'Jungle',
    'Fossil',
    'Base Set 2',
    'Team Rocket',
    'Gym Heroes',
    'Gym Challenge',
    'Neo Genesis',
    'Neo Discovery',
    'Neo Revelation',
    'Neo Destiny',
    'Legendary Collection',
  ]) {
    expect(within(classic).getByRole('group', { name })).toBeInTheDocument();
  }
});

test('buying a Base Set pack opens 11 cards from Base Set', async () => {
  await withProfile();
  render(<Shop />);
  fireEvent.click(
    within(screen.getByRole('group', { name: 'Base Set' })).getByRole('button', { name: 'Buy & open' }),
  );
  const opening = await screen.findByRole('dialog', { name: 'Pack opening' });
  expect(await within(opening).findByText('Card 0 of 11', {}, { timeout: 3000 })).toBeInTheDocument();
  const ids = Object.keys(useProfile.getState().profile.collection);
  expect(ids.every((id) => id.startsWith('base1-'))).toBe(true);
});

test('the binder groups sets by era and labels classic cards, with no Playable badge', async () => {
  await withProfile({ collection: { [vanilla.id]: 1 } });
  render(<Binder />);
  const picker = screen.getByRole('group', { name: 'Sets' });
  expect(within(picker).getByText('Classic')).toBeInTheDocument();
  fireEvent.click(within(picker).getByRole('button', { name: 'Base Set' }));
  expect(screen.queryAllByText('Playable')).toHaveLength(0);
  const item = screen.getByRole('listitem', { name: `${vanilla.name} #${vanilla.id.split('-')[1]}` });
  expect(within(item).getByText('Classic')).toBeInTheDocument();
});

test('owned classic cards cannot be added to a deck', async () => {
  await withProfile({ collection: { [charizard]: 1 } });
  render(<DeckBuilder />);
  fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
  const list = screen.getByRole('list', { name: 'Available cards' });
  expect(within(list).getByRole('button', { name: 'Add Charizard' })).toBeDisabled();
  expect(within(list).getByText('Classic: not playable yet')).toBeInTheDocument();
  // Basic Energy comes from the modern energy set only (one of each type)
  expect(within(list).getAllByRole('button', { name: 'Add Fire Energy' })).toHaveLength(1);
});

test('with "Skip title screen" on, a returning player opens on the main menu', async () => {
  await withProfile({ introDone: true });
  useSettings.setState({ skipTitle: true });
  useNav.setState({ route: 'title' });
  render(<App botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
  expect(await screen.findByRole('menu', { name: 'Main menu' })).toBeInTheDocument();
});

test('"Skip title screen" never skips the intro for a new player', async () => {
  await withProfile();
  useSettings.setState({ skipTitle: true });
  useNav.setState({ route: 'title' });
  render(<App botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} />);
  await waitFor(() => expect(screen.getByText('PRESS START')).toBeInTheDocument());
  expect(useNav.getState().route).toBe('title');
});

test('Options has a Skip title screen toggle', async () => {
  await withProfile({ introDone: true });
  render(<App botClient={{ choose: () => new Promise(() => {}) }} botDelayMs={0} startAt="options" />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Skip title screen' }));
  expect(useSettings.getState().skipTitle).toBe(true);
});

test('cards you can use are listed before classic ones in the deck builder', async () => {
  await withProfile({ collection: { [charizard]: 1, 'me02-054': 2 } });
  render(<DeckBuilder />);
  fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
  const names = within(screen.getByRole('list', { name: 'Available cards' }))
    .getAllByRole('button', { name: /^Add / })
    .map((b) => b.getAttribute('aria-label'));
  expect(names.indexOf('Add Gastly')).toBeLessThan(names.indexOf('Add Charizard'));
});
