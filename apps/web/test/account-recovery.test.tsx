import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, test } from 'vitest';
import { App } from '../src/App.tsx';
import { createFakeCloud } from '../src/cloud/fakeApi.ts';
import { useCloud } from '../src/cloud/useCloud.ts';
import { useNav } from '../src/nav/useNav.ts';
import { createMemoryStore } from '../src/profile/memoryStore.ts';
import { newProfile } from '../src/profile/types.ts';
import { useProfile } from '../src/profile/useProfile.ts';
import { LinkProblemDialog, RecoveryDialog } from '../src/ui/account/RecoveryDialog.tsx';
import { Title } from '../src/screens/Title.tsx';

beforeEach(() => {
  useCloud.getState().reset();
  history.replaceState(null, '', '/');
});

async function setup(signedIn: boolean) {
  const fake = createFakeCloud();
  await fake.api.signUp('ash@example.com', 'pikachu99');
  fake.server.users.get('ash@example.com')!.confirmed = true;
  if (signedIn) await fake.api.signIn('ash@example.com', 'pikachu99');
  await act(() => useCloud.getState().init(fake.api));
  render(<RecoveryDialog />);
  return fake;
}
const dialog = () => screen.queryByRole('dialog', { name: 'Choose a new password' });
const field = () => screen.getByLabelText('New password', { exact: true });

describe('RecoveryDialog', () => {
  test('nothing shows until a recovery event; then a blocking dialog opens with the field focused', async () => {
    const fake = await setup(true);
    expect(dialog()).toBeNull();
    act(() => fake.emit('passwordRecovery'));
    expect(dialog()).toBeInTheDocument();
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(field()).toHaveFocus();
  });

  test('Escape does not close it and Tab stays inside', async () => {
    const fake = await setup(true);
    act(() => fake.emit('passwordRecovery'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog()).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    buttons.at(-1)!.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(dialog()!.contains(document.activeElement)).toBe(true);
  });

  test('a short password shows the message and keeps the dialog', async () => {
    const fake = await setup(true);
    act(() => fake.emit('passwordRecovery'));
    fireEvent.change(field(), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 8 characters.');
    expect(dialog()).toBeInTheDocument();
  });

  test('saving shows the success message in the dialog, and Continue closes it, still signed in', async () => {
    const fake = await setup(true);
    act(() => fake.emit('passwordRecovery'));
    fireEvent.change(field(), { target: { value: 'newpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('Password updated. You are signed in.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(dialog()).toBeNull();
    expect(useCloud.getState().user?.email).toBe('ash@example.com');
    expect(fake.server.users.get('ash@example.com')!.password).toBe('newpassword1');
  });

  test('an expired link shows the plain message, and Not now closes the dialog and signs out of that session', async () => {
    const fake = await setup(false);
    act(() => fake.emit('passwordRecovery'));
    fireEvent.change(field(), { target: { value: 'newpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That link has expired. Ask for a new one.');
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(useCloud.getState()).toMatchObject({ recovering: false, user: null });
  });

  test('typing in the dialog on the Title screen does not start the game (Title ignores keys in a dialog)', async () => {
    await useProfile.getState().init(createMemoryStore({ ...newProfile(), introDone: true }), true);
    useNav.setState({ route: 'title' });
    const fake = createFakeCloud();
    await act(() => useCloud.getState().init(fake.api));
    render(
      <>
        <Title />
        <RecoveryDialog />
      </>,
    );
    act(() => fake.emit('passwordRecovery'));
    fireEvent.keyDown(field(), { key: 'p' });
    fireEvent.click(field());
    expect(useNav.getState().route).toBe('title');
  });

  test('the rest of the app is inert while the dialog is open', async () => {
    const never = { choose: () => new Promise<never>(() => {}) };
    const fake = createFakeCloud();
    await act(() => useCloud.getState().init(fake.api));
    render(<App botClient={never} botDelayMs={0} />);
    expect(document.querySelector('[inert]')).toBeNull();
    act(() => fake.emit('passwordRecovery'));
    expect(document.querySelector('[inert]')).not.toBeNull();
    expect(dialog()).toBeInTheDocument();
    expect(dialog()!.closest('[inert]')).toBeNull();
  });
});

describe('LinkProblemDialog', () => {
  test('an expired link in the URL opens a dialog with the plain message, and OK dismisses it', async () => {
    history.replaceState(null, '', '/#error=access_denied&error_code=otp_expired');
    await act(() => useCloud.getState().init(createFakeCloud().api));
    render(<LinkProblemDialog />);
    expect(screen.getByRole('dialog', { name: 'Link problem' })).toHaveTextContent(
      'That link has expired. Ask for a new one.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('dialog', { name: 'Link problem' })).toBeNull();
  });
});
