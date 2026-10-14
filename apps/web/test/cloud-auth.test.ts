import { beforeEach, describe, expect, test } from 'vitest';
import { createFakeCloud } from '../src/cloud/fakeApi.ts';
import { useCloud, validateCredentials } from '../src/cloud/useCloud.ts';

beforeEach(() => useCloud.getState().reset());

async function confirmed(email = 'ash@example.com', password = 'pikachu99') {
  const fake = createFakeCloud();
  await fake.api.signUp(email, password);
  fake.server.users.get(email)!.confirmed = true;
  return fake;
}

describe('useCloud', () => {
  test('with no API the store is disabled and its actions do nothing', async () => {
    await useCloud.getState().init(null);
    expect(useCloud.getState()).toMatchObject({ enabled: false, ready: true, user: null });
    await useCloud.getState().signIn('a@b.co', 'longenough');
    await useCloud.getState().signUp('a@b.co', 'longenough');
    expect(useCloud.getState()).toMatchObject({ enabled: false, user: null, busy: false, notice: null });
  });

  test('init restores a signed-in user and follows sign-out events', async () => {
    const fake = await confirmed();
    await fake.api.signIn('ash@example.com', 'pikachu99');
    await useCloud.getState().init(fake.api);
    expect(useCloud.getState()).toMatchObject({ enabled: true, ready: true });
    expect(useCloud.getState().user?.email).toBe('ash@example.com');
    await fake.api.signOut();
    expect(useCloud.getState().user).toBeNull();
  });

  test('validateCredentials checks the email shape and the password length', () => {
    expect(validateCredentials('nope', 'longenough')).toBe('Enter a valid email.');
    expect(validateCredentials('a@b.co', 'short')).toBe('Use at least 8 characters.');
    expect(validateCredentials('a@b.co', 'longenough')).toBeNull();
  });

  test('signUp validates, then reports the confirmation notice; a taken email shows the plain sentence', async () => {
    const fake = createFakeCloud();
    await useCloud.getState().init(fake.api);
    await useCloud.getState().signUp('bad', 'longenough');
    expect(useCloud.getState().error).toBe('Enter a valid email.');
    expect(fake.server.users.size).toBe(0);
    await useCloud.getState().signUp('a@b.co', 'longenough');
    expect(useCloud.getState()).toMatchObject({
      error: null,
      notice: 'Check your email to confirm your account.',
    });
    await useCloud.getState().signUp('a@b.co', 'longenough');
    expect(useCloud.getState().error).toBe('That email is already in use.');
  });

  test('signIn with a wrong password shows the error and stays signed out; the right one signs in', async () => {
    const fake = await confirmed();
    await useCloud.getState().init(fake.api);
    await useCloud.getState().signIn('ash@example.com', 'wrongwrong');
    expect(useCloud.getState()).toMatchObject({ error: 'Wrong email or password.', user: null });
    await useCloud.getState().signIn('ash@example.com', 'pikachu99');
    expect(useCloud.getState()).toMatchObject({ error: null });
    expect(useCloud.getState().user?.email).toBe('ash@example.com');
  });

  test('signOut clears the user', async () => {
    const fake = await confirmed();
    await useCloud.getState().init(fake.api);
    await useCloud.getState().signIn('ash@example.com', 'pikachu99');
    await useCloud.getState().signOut();
    expect(useCloud.getState().user).toBeNull();
  });

  test('requestReset shows the same notice for any email', async () => {
    const fake = await confirmed();
    await useCloud.getState().init(fake.api);
    await useCloud.getState().requestReset('ash@example.com');
    const known = useCloud.getState().notice;
    useCloud.getState().clearMessages();
    await useCloud.getState().requestReset('nobody@example.com');
    expect(useCloud.getState().notice).toBe(known);
    expect(known).toBe('If that email has an account, a reset link is on its way.');
  });

  test('a recovery event sets recovering and setNewPassword clears it', async () => {
    const fake = await confirmed();
    await fake.api.signIn('ash@example.com', 'pikachu99');
    await useCloud.getState().init(fake.api);
    fake.emit('passwordRecovery');
    expect(useCloud.getState().recovering).toBe(true);
    await useCloud.getState().setNewPassword('short');
    expect(useCloud.getState()).toMatchObject({ recovering: true, error: 'Use at least 8 characters.' });
    await useCloud.getState().setNewPassword('newpassword1');
    expect(useCloud.getState()).toMatchObject({
      recovering: false,
      error: null,
      notice: 'Password updated. You are signed in.',
    });
    expect(fake.server.users.get('ash@example.com')!.password).toBe('newpassword1');
  });

  test('an expired recovery link shows the plain message and keeps the dialog', async () => {
    const fake = createFakeCloud();
    await useCloud.getState().init(fake.api);
    fake.emit('passwordRecovery');
    await useCloud.getState().setNewPassword('newpassword1');
    expect(useCloud.getState()).toMatchObject({
      recovering: true,
      error: 'That link has expired. Ask for a new one.',
    });
  });

  test('busy is true while a call is in flight and false after, including after an error', async () => {
    const fake = await confirmed();
    await useCloud.getState().init(fake.api);
    const pending = useCloud.getState().signIn('ash@example.com', 'wrongwrong');
    expect(useCloud.getState().busy).toBe(true);
    await pending;
    expect(useCloud.getState().busy).toBe(false);
  });
});
