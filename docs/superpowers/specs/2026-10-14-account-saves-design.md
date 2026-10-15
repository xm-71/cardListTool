# Account saves (Supabase) — design

Date: 2026-10-14 · Status: approved · Depends on: the profile store seam (`ProfileStore` in
`apps/web/src/profile/types.ts`), shipped

## Goal

A player can create an account and sign in on any device to get the same save (credits, collection, decks, binders,
Gym and Frontier progress). The game stays fully playable offline and signed out; accounts only add cloud backup and
sync. Hosted on Supabase's free tier, with real email + password sign-in.

## Success criteria

- Signed out, nothing changes: the game works exactly as today from the browser's IndexedDB save.
- A player can sign up with an email and password (confirming the email), sign in, sign out, and reset a forgotten
  password by email.
- Signed in, progress is saved to the cloud shortly after each change, and a second device that signs in loads it.
- Signing in on a device that already has a save asks once which save to keep (showing both: credits, cards owned,
  badges), then newest wins.
- Offline, or when Supabase is unreachable or paused, play continues from the local save; the cloud catches up when
  it is reachable again. Nothing the player earned is lost by a failed sync.
- Passwords are never handled by our code; the cloud save of one account is unreadable by any other account.

## Rules

### Where the save lives

- The local IndexedDB save stays the source the game reads and writes (`useProfile.change`). The cloud is a mirror:
  after a local save, a debounced push sends the profile to the cloud; on sign-in, a pull compares and may replace
  the local save. No gameplay code changes.
- One cloud row per account: table `player_saves(user_id uuid primary key references auth.users, data jsonb not null,
rev integer not null, updated_at timestamptz not null default now())`. `data` is the `Profile` JSON as the app
  already stores it (`version: 1`, normalised on load by `normalizeProfile`).
- Row-level security: a signed-in user can select, insert and update only the row where `user_id = auth.uid()`.
  The SQL lives in `supabase/migrations/` in the repo and is run by hand in the Supabase SQL editor.

### Sync and conflicts

- `rev` counts cloud writes. A push is `update … set data, rev = rev + 1 where user_id = me and rev = <the rev this
device last saw>`; zero rows updated means another device saved in between.
- On a rev mismatch the device does not overwrite: it pulls, and shows the same "which save?" choice as first
  sign-in (this device vs the cloud), with a summary of each. The chosen save becomes the cloud save.
- First sign-in on a device with local progress and an existing cloud save: show the choice. With no cloud row yet:
  upload the local save. With a brand-new local save and an existing cloud row: take the cloud save, no question.
- The choice dialog never auto-dismisses and playing is blocked behind it (it is short, and prevents writing to a
  save that is about to be replaced).
- Sign-out keeps the local save on the device and stops syncing. Signing in as a different account on a device that
  holds another account's save shows the same choice.
- Local saves keep working when sync fails; a small status line in Options shows "Saved to your account · time",
  "Saving…", "Offline: will sync later" or the error.

### Accounts

- Email + password through Supabase Auth: sign up (email confirmation on), sign in, sign out, "Forgot password" email
  and a set-new-password form when the reset link brings the player back to the app.
- Accounts are optional and live in **Options → Account**. Signed out it offers "Create account" and "Sign in" with a
  line saying what an account is for; signed in it shows the email, sync status and "Sign out".
- Validation: email shape and a password of at least 8 characters, with Supabase's own error messages mapped to plain
  sentences ("That email is already in use.", "Wrong email or password.").
- Collector mode and every other setting stay as they are; only the profile syncs (not Options, sound or theme).

### Configuration

- The browser needs the project URL and the public anon key: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, set in
  Vercel (and a local `.env` for development). They are public by design; row-level security is the protection.
- With either variable missing the Account section is hidden and the app behaves as signed out, so builds, previews
  and tests without the variables still work.
- The player (not code) creates the Supabase project, runs the migration, turns on email confirmation and sets the
  site URL and redirect URL to the Vercel domain. The plan lists these as setup steps for the player.

### Security notes (accepted)

- The save is written by the client, so a determined player could edit their own credits in their own row. This is a
  private game and the profile is already editable in the browser; no server-side validation of the profile.
- A Supabase free project pauses after 7 days without database activity: sync fails with an "unavailable" status until
  the player restarts it from the dashboard; play is unaffected. No backups on the free plan are assumed.

## Code shape

- `apps/web/src/cloud/cloudApi.ts`: the interface the app depends on (sign up/in/out, reset, update password,
  `onAuthChange`, `loadSave(): {data, rev} | null`, `saveSave(data, expectedRev)`), so everything below is tested
  with a fake and no network.
- `apps/web/src/cloud/supabaseApi.ts`: the real implementation using `@supabase/supabase-js` (dynamic import, so it
  stays out of the main bundle until needed); `cloud/config.ts` reads the two variables.
- `apps/web/src/cloud/sync.ts` (pure): decides pull/push/ask from local and cloud state; `summarise(profile)` for the
  choice dialog. `cloud/useCloud.ts` (Zustand): auth state, sync status, the debounced push after local saves, the
  pull on sign-in and on app start.
- `apps/web/src/screens/Options.tsx` + `apps/web/src/ui/account/*`: the Account section, sign-up/in forms, the
  forgot-password flow and the "which save?" dialog.
- `supabase/migrations/001_player_saves.sql`, and a short `docs/accounts-setup.md` with the setup steps.
- Service worker: Supabase calls are cross-origin and never cached.

## Delivery

Two PRs. **4a** accounts without sync: the cloud seam, Supabase client, Account section, sign up/in/out and password
reset. **4b** sync: `player_saves`, push/pull, the conflict choice, status line, and the offline behaviour.

## Tests

- Pure: `sync.ts` decisions (no cloud row → upload; no local progress + cloud row → take cloud; both → ask; rev
  mismatch → ask), `summarise`, config with and without variables.
- Cloud store with a fake `CloudApi`: debounce, retry after failure, rev handling, a failed push never loses local
  progress, sign-out stops pushing, sign-in as another account asks.
- Screens: Account section signed out/in, validation messages, forgot password, the choice dialog (both saves shown,
  keep this device / keep cloud), hidden when the variables are missing, status line states.
- E2E at 390 and 1400 px with the cloud faked in the page: sign in → choice dialog → the chosen save is the one the
  game uses; no sideways scroll.
- A manual checklist against the real Supabase project is part of the PR description (sign up, confirm, sign in on a
  second browser, change something, see it arrive).

## Not in this part

- Social features, leaderboards, trading, server-side validation of saves, deleting an account from the app,
  merging two saves, syncing Options/theme, social logins, an offline-first conflict-free merge.
