import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, test } from 'vitest';
import { createFakeCloud } from '../src/cloud/fakeApi.ts';
import { useCloud } from '../src/cloud/useCloud.ts';
import { Options } from '../src/screens/Options.tsx';

beforeEach(() => useCloud.getState().reset());

async function setup() {
  const fake = createFakeCloud();
  await fake.api.signUp('ash@example.com', 'pikachu99');
  fake.server.users.get('ash@example.com')!.confirmed = true;
  await act(() => useCloud.getState().init(fake.api));
  render(<Options />);
  return fake;
}
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('Options → Account', () => {
  test('the section is absent when the cloud is not configured', async () => {
    await act(() => useCloud.getState().init(null));
    render(<Options />);
    expect(screen.queryByRole('heading', { name: 'Account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  test('signed out it explains accounts and offers Create account and Sign in', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByText(/saves your progress online so you can play on any device/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  test('Create account validates the fields and shows the confirmation notice', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    type('Email', 'nope');
    type('Password', 'longenough');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email.');
    type('Email', 'misty@example.com');
    type('Password', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Use at least 8 characters.'));
    type('Password', 'longenough');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Check your email to confirm your account.'),
    );
  });

  test('a failed sign-in shows the error in an alert and keeps the form', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    type('Email', 'ash@example.com');
    type('Password', 'wrongwrong');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Wrong email or password.'));
    expect(screen.getByLabelText('Email')).toHaveValue('ash@example.com');
  });

  test('signing in shows the email and a Sign out button, which signs out', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    type('Email', 'ash@example.com');
    type('Password', 'pikachu99');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Signed in as ash@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await screen.findByRole('button', { name: 'Create account' });
    expect(screen.queryByText(/Signed in as/)).toBeNull();
  });

  test('Forgot password sends a reset and shows the notice', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    type('Email', 'ash@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'If that email has an account, a reset link is on its way.',
      ),
    );
  });

  test('Options still shows every existing control', async () => {
    await setup();
    expect(screen.getByLabelText('Sound')).toBeInTheDocument();
    expect(screen.getByLabelText('Skip title screen')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Battle animations' })).toBeInTheDocument();
    expect(screen.getByLabelText('Collector mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Change name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replay intro' })).toBeInTheDocument();
    void within;
  });
});
