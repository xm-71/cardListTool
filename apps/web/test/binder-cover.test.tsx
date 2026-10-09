import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../src/App.tsx';
import { useGame } from '../src/game/store.ts';
import { useNav } from '../src/nav/useNav.ts';
import { newBinder } from '../src/profile/binders.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile, type CustomBinder } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { useSettings } from '../src/settings/useSettings.ts';
import { BinderCover } from '../src/ui/binder/BinderCover.tsx';
import { CoverEditor } from '../src/ui/binder/CoverEditor.tsx';

beforeEach(() => useSettings.getState().setSound(false));
afterEach(() => vi.restoreAllMocks());

const binder = (over: Partial<CustomBinder> = {}): CustomBinder => ({ ...newBinder('b1', 0), ...over });

test('a cover shows its stickers, name and card count', () => {
  render(
    <BinderCover binder={binder({ name: 'Fire!', stickers: { topLeft: 'star', bottomRight: 'heart' } })} />,
  );
  expect(screen.getByRole('img', { name: 'star' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'heart' })).toBeInTheDocument();
  expect(screen.getByText('Fire!')).toBeInTheDocument();
  expect(screen.getByText('0 cards')).toBeInTheDocument();
});

test('the editor previews changes live and saves them', () => {
  const onSave = vi.fn();
  render(<CoverEditor binder={binder()} onSave={onSave} onClose={() => {}} />);
  const dialog = screen.getByRole('dialog', { name: 'Edit binder' });
  fireEvent.change(within(dialog).getByLabelText('Binder name'), { target: { value: 'Shinies' } });
  fireEvent.click(
    within(within(dialog).getByRole('radiogroup', { name: 'Cover colour' })).getByRole('radio', {
      name: 'blue',
    }),
  );
  fireEvent.click(
    within(within(dialog).getByRole('radiogroup', { name: 'Background' })).getByRole('radio', {
      name: 'stars',
    }),
  );
  fireEvent.change(within(dialog).getByLabelText('Top left sticker'), { target: { value: 'crown' } });
  const preview = within(dialog).getByTestId('binder-cover');
  expect(preview).toHaveAttribute('data-color', 'blue');
  expect(preview).toHaveAttribute('data-background', 'stars');
  expect(within(preview).getByText('Shinies')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Shinies',
      coverColor: 'blue',
      background: 'stars',
      stickers: { topLeft: 'crown' },
    }),
  );
});

test('"None" removes a sticker and an empty name saves as My binder', () => {
  const onSave = vi.fn();
  render(
    <CoverEditor binder={binder({ stickers: { topRight: 'bolt' } })} onSave={onSave} onClose={() => {}} />,
  );
  fireEvent.change(screen.getByLabelText('Top right sticker'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Binder name'), { target: { value: '   ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'My binder', stickers: {} }));
});

test('Delete asks to confirm first', () => {
  const onDelete = vi.fn();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<CoverEditor binder={binder()} onSave={() => {}} onDelete={onDelete} onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete binder' }));
  expect(onDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete binder' }));
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(onDelete).toHaveBeenCalledTimes(1);
});

test('in Collector mode the menu shows the most recently edited binder', async () => {
  useGame.getState().reset();
  useProfile.getState().reset();
  useNav.setState({ route: 'menu' });
  const old = binder({ id: 'old', name: 'Old one', updatedAt: 1 });
  const recent = binder({ id: 'new', name: 'Newest', updatedAt: 9 });
  await useProfile
    .getState()
    .init(
      createMemoryStore({ ...newProfile(), introDone: true, collectorMode: true, binders: [recent, old] }),
      true,
    );
  render(<App botClient={{ choose: () => new Promise<never>(() => {}) }} botDelayMs={0} />);
  await waitFor(() => expect(screen.getByText('Newest')).toBeInTheDocument());
  expect(screen.queryByText('Old one')).toBeNull();
});
