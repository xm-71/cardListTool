import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, test } from 'vitest';
import { createFakeCloud } from '../src/cloud/fakeApi.ts';
import { useCloud } from '../src/cloud/useCloud.ts';
import { RecoveryDialog } from '../src/ui/account/RecoveryDialog.tsx';

beforeEach(() => useCloud.getState().reset());

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

describe('RecoveryDialog', () => {
  test('nothing shows until a recovery event; then a blocking dialog opens', async () => {
    const fake = await setup(true);
    expect(dialog()).toBeNull();
    act(() => fake.emit('passwordRecovery'));
    expect(dialog()).toBeInTheDocument();
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
  });

  test('a short password shows the message and keeps the dialog', async () => {
    const fake = await setup(true);
    act(() => fake.emit('passwordRecovery'));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 8 characters.');
    expect(dialog()).toBeInTheDocument();
  });

  test('saving closes the dialog and leaves the player signed in', async () => {
    const fake = await setup(true);
    act(() => fake.emit('passwordRecovery'));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(useCloud.getState().user?.email).toBe('ash@example.com');
    expect(useCloud.getState().notice).toBe('Password updated. You are signed in.');
    expect(fake.server.users.get('ash@example.com')!.password).toBe('newpassword1');
  });

  test('an expired link shows the plain message', async () => {
    const fake = await setup(false);
    act(() => fake.emit('passwordRecovery'));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That link has expired. Ask for a new one.');
    expect(dialog()).toBeInTheDocument();
  });
});
