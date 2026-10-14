import { useState } from 'react';
import { useCloud } from '../../cloud/useCloud.ts';
import { Button } from '../retro/index.ts';

/** Opens when the player follows a password-reset link: they must choose a new password before going on. */
export function RecoveryDialog() {
  const recovering = useCloud((s) => s.recovering);
  const busy = useCloud((s) => s.busy);
  const error = useCloud((s) => s.error);
  const setNewPassword = useCloud((s) => s.setNewPassword);
  const [password, setPassword] = useState('');
  if (!recovering) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a new password"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-fixed/70 p-6"
    >
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
        <Button type="submit" disabled={busy} className="self-start">
          Save password
        </Button>
      </form>
    </div>
  );
}
