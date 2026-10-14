import { useState } from 'react';
import { useCloud } from '../../cloud/useCloud.ts';
import { Button } from '../retro/index.ts';

export type AuthMode = 'signUp' | 'signIn';

const FIELD = 'min-w-0 border-b-4 border-ink bg-transparent px-1 font-pixel text-sm outline-none';

/** The email + password form for creating an account or signing in. Closes itself when the call worked. */
export function AuthForm({ mode, onDone }: { mode: AuthMode; onDone(): void }) {
  const busy = useCloud((s) => s.busy);
  const signUp = useCloud((s) => s.signUp);
  const signIn = useCloud((s) => s.signIn);
  const requestReset = useCloud((s) => s.requestReset);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const label = mode === 'signUp' ? 'Create account' : 'Sign in';

  const submit = async () => {
    await (mode === 'signUp' ? signUp(email, password) : signIn(email, password));
    if (!useCloud.getState().error) onDone();
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="font-pixel text-[10px]">Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-pixel text-[10px]">Password</span>
        <input
          type="password"
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy}>
          {label}
        </Button>
        <Button variant="plain" onClick={onDone}>
          Cancel
        </Button>
        {mode === 'signIn' && (
          <Button variant="plain" disabled={busy} onClick={() => void requestReset(email)}>
            Forgot password?
          </Button>
        )}
      </div>
    </form>
  );
}
