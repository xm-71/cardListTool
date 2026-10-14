import { useRef, useState } from 'react';
import { useCloud } from '../../cloud/useCloud.ts';
import { useDialog } from '../binder/useDialog.ts';
import { Button } from '../retro/index.ts';

const noop = () => {};
const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-ink-fixed/70 p-6';

/** Opens when the player follows a password-reset link: they choose a new password before going on. */
export function RecoveryDialog() {
  const open = useCloud((s) => s.recovering || s.recoverySaved);
  return open ? <RecoveryBody /> : null;
}

function RecoveryBody() {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, noop); // focus moves in, Tab stays in, Escape does nothing: the dialog has to be answered
  const saved = useCloud((s) => s.recoverySaved);
  const busy = useCloud((s) => s.busy);
  const error = useCloud((s) => s.error);
  const setNewPassword = useCloud((s) => s.setNewPassword);
  const cancelRecovery = useCloud((s) => s.cancelRecovery);
  const acknowledge = useCloud((s) => s.acknowledgeRecovery);
  const [password, setPassword] = useState('');
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Choose a new password" className={OVERLAY}>
      {saved ? (
        <div className="retro-box flex w-full max-w-md flex-col gap-4 p-6">
          <p className="text-xl">Password updated. You are signed in.</p>
          <Button className="self-start" onClick={acknowledge}>
            Continue
          </Button>
        </div>
      ) : (
        <form
          noValidate
          className="retro-box flex w-full max-w-md flex-col gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void setNewPassword(password);
          }}
        >
          <h2 className="font-pixel text-xs uppercase">Choose a new password</h2>
          <label className="flex flex-col gap-2">
            <span className="font-pixel text-[10px]">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-w-0 border-b-4 border-ink bg-transparent px-1 font-pixel text-sm outline-none"
            />
          </label>
          {error && (
            <p role="alert" className="text-xl text-red-fg">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>
              Save password
            </Button>
            <Button variant="plain" disabled={busy} onClick={() => void cancelRecovery()}>
              Not now
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Tells the player their confirmation or reset link was expired or invalid (Supabase only puts that in the URL). */
export function LinkProblemDialog() {
  const problem = useCloud((s) => s.linkProblem);
  return problem ? <LinkProblemBody message={problem} /> : null;
}

function LinkProblemBody({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useCloud((s) => s.dismissLinkProblem);
  useDialog(ref, dismiss);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Link problem" className={OVERLAY}>
      <div className="retro-box flex w-full max-w-md flex-col gap-4 p-6">
        <p className="text-xl">{message}</p>
        <Button className="self-start" onClick={dismiss}>
          OK
        </Button>
      </div>
    </div>
  );
}
