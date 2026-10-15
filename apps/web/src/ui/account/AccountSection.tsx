import { useState } from 'react';
import { useCloud } from '../../cloud/useCloud.ts';
import { Box, Button } from '../retro/index.ts';
import { AuthForm, type AuthMode } from './AuthForm.tsx';

/** Options → Account: create an account, sign in and out. Hidden when the build has no account service. */
export function AccountSection() {
  const enabled = useCloud((s) => s.enabled);
  const user = useCloud((s) => s.user);
  const error = useCloud((s) => s.error);
  const notice = useCloud((s) => s.notice);
  const busy = useCloud((s) => s.busy);
  const signOut = useCloud((s) => s.signOut);
  const clearMessages = useCloud((s) => s.clearMessages);
  const [form, setForm] = useState<AuthMode | null>(null);
  if (!enabled) return null;

  const open = (mode: AuthMode) => {
    clearMessages();
    setForm(mode);
  };
  const close = () => setForm(null);

  return (
    <Box title="Account">
      <div className="flex flex-col gap-3">
        {user ? (
          <>
            <p className="text-xl break-all">Signed in as {user.email}</p>
            <Button className="self-start" variant="plain" disabled={busy} onClick={() => void signOut()}>
              Sign out
            </Button>
          </>
        ) : form ? (
          <AuthForm key={form} mode={form} onDone={close} />
        ) : (
          <>
            <p className="text-xl">An account saves your progress online so you can play on any device.</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => open('signUp')}>Create account</Button>
              <Button variant="plain" onClick={() => open('signIn')}>
                Sign in
              </Button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-xl text-red-fg">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-xl">
            {notice}
          </p>
        )}
      </div>
    </Box>
  );
}
