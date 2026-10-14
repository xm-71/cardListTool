# Account Saves (Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A player can create an account and sign in on any device to get the same save, while the game stays fully playable offline and signed out.

**Architecture:** The local IndexedDB save stays the source the game reads and writes. A new `cloud` layer (an injectable `CloudApi`, a Supabase implementation, a Zustand `useCloud` store and a pure `sync.ts`) mirrors the profile to one Supabase row per account and decides pull/push/ask on sign-in. Everything is built against a fake `CloudApi`, so no test touches the network. Two PRs: **4a** accounts without sync (Tasks 1–5), **4b** sync (Tasks 6–10).

**Tech Stack:** TypeScript, React 19, Zustand, Vite (`import.meta.env`), `@supabase/supabase-js` (dynamic import), vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-14-account-saves-design.md`

## Global Constraints

- Local IndexedDB save stays the source the game reads and writes (`useProfile.change`); the cloud is a mirror. No gameplay code changes; only the `Profile` syncs (not Options, sound or theme).
- Sign-in: email + password through Supabase Auth, email confirmation on, "Forgot password" by email and a set-new-password form. Password of at least 8 characters; email shape checked.
- Plain error sentences: "That email is already in use.", "Wrong email or password."
- Cloud row: table `player_saves(user_id uuid primary key references auth.users, data jsonb not null, rev integer not null, updated_at timestamptz not null default now())`; row-level security lets a user select, insert and update only `user_id = auth.uid()`. SQL in `supabase/migrations/001_player_saves.sql`.
- Push is `update … set data, rev = rev + 1 where user_id = me and rev = <the rev this device last saw>`; zero rows updated is a conflict.
- Config from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; with either missing the Account section is hidden and the app behaves as signed out. `@supabase/supabase-js` is loaded with a dynamic `import()`.
- First sign-in rules: no cloud row → upload local; brand-new local save and a cloud row → take the cloud save without asking; both have progress → ask once (both saves summarised), then newest wins. The choice dialog blocks play until answered.
- Sign-out keeps the local save and stops syncing. Supabase calls are cross-origin and never cached by the service worker (`sw.template.js` already ignores other origins; Task 5 confirms).
- UI: Options → Account; status line text: "Saved to your account · <time>", "Saving…", "Offline: will sync later", or the error. Phone: no sideways scroll at 390 px.
- Commit trailers per the session attribution reminder. Use absolute paths; never `cd ..`.

## Review Focus

1. A failed push, a failed pull or going offline must never lose or replace local progress (the local save is only replaced by an explicit "keep cloud" choice or the brand-new-local rule).
2. Signing in as account B on a device whose save is linked to account A must ask, never upload A's save into B's row or silently replace it.
3. A push with a stale `rev` (another device saved in between) must not overwrite: it ends in the same "which save?" choice.
4. With no env variables (builds, previews, tests, e2e): no network calls, no Account section, the game works as today.
5. Session and recovery: a reload keeps the session; the password-recovery link opens the set-new-password form; an expired or invalid link gives a plain message.

---

## 4a — Accounts without sync

### Task 1: The cloud seam, config and the Supabase implementation

**Files:**

- Create: `apps/web/src/cloud/cloudApi.ts`, `apps/web/src/cloud/errors.ts`, `apps/web/src/cloud/config.ts`, `apps/web/src/cloud/supabaseApi.ts`, `apps/web/src/cloud/fakeApi.ts`
- Modify: `apps/web/package.json` (dependency `@supabase/supabase-js`, install with pnpm)
- Test: `apps/web/test/cloud-api.test.ts`

**Interfaces:**

- Produces (`cloudApi.ts`):
  - `interface CloudUser { id: string; email: string }`
  - `type CloudErrorCode = 'emailInUse' | 'invalidCredentials' | 'weakPassword' | 'invalidLink' | 'network' | 'unavailable' | 'unknown'`; `class CloudError extends Error { constructor(readonly code: CloudErrorCode) }`
  - `type AuthEvent = 'signedIn' | 'signedOut' | 'passwordRecovery'`
  - `interface CloudSave { data: unknown; rev: number }`
  - `type SaveResult = { ok: true; rev: number } | { ok: false }` (`ok: false` is a rev conflict)
  - `interface CloudApi { getUser(): Promise<CloudUser | null>; signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>; signIn(email: string, password: string): Promise<CloudUser>; signOut(): Promise<void>; requestPasswordReset(email: string): Promise<void>; updatePassword(password: string): Promise<void>; onAuthChange(cb: (e: AuthEvent, user: CloudUser | null) => void): () => void; loadSave(): Promise<CloudSave | null>; saveSave(data: Profile, expectedRev: number): Promise<SaveResult> }`
- Produces (`errors.ts`): `friendlyMessage(code: CloudErrorCode): string` ("emailInUse" → "That email is already in use.", "invalidCredentials" → "Wrong email or password.", "weakPassword" → "Use at least 8 characters.", "invalidLink" → "That link has expired. Ask for a new one.", "network" → "You seem to be offline.", "unavailable" → "The account service is unavailable right now.", "unknown" → "Something went wrong. Try again.").
- Produces (`config.ts`): `cloudConfig(env?: Record<string, string | undefined>): { url: string; key: string } | null` (defaults to `import.meta.env`; null unless both variables are non-empty).
- Produces (`supabaseApi.ts`): `createSupabaseApi(client: SupabaseLike): CloudApi` where `SupabaseLike` is the minimal subset of the Supabase client the file uses (so tests pass a stub), and `loadSupabaseApi(cfg: { url: string; key: string }): Promise<CloudApi>` which dynamically imports `@supabase/supabase-js` and calls `createClient` (auth `persistSession: true`, `detectSessionInUrl: true`).
- Produces (`fakeApi.ts`): `createFakeCloud(): { api: CloudApi; server: { users: Map<string, { id: string; password: string; confirmed: boolean }>; saves: Map<string, CloudSave>; offline: boolean; unavailable: boolean }; emit(e: AuthEvent): void }` — an in-memory server used by every unit test and the e2e (`?cloud=fake`); rev semantics identical to the SQL above.

- [ ] **Step 1: Failing tests** (`cloud-api.test.ts`): `cloudConfig is null unless both variables are set`; `friendlyMessage has a sentence for every code`; `the fake: sign up needs confirmation, sign in before confirming is invalidCredentials, after confirming returns the user`; `the fake: saveSave with rev 0 inserts at rev 1, with the current rev bumps it, with a stale rev returns { ok: false }`; `the fake: loadSave returns null with no row and only the signed-in user's row`; `the fake: offline throws CloudError network, unavailable throws CloudError unavailable`; `createSupabaseApi maps error messages: "User already registered" → emailInUse, "Invalid login credentials" → invalidCredentials, "Password should be at least" → weakPassword, a fetch TypeError → network`; `createSupabaseApi.saveSave updates with .eq('user_id').eq('rev', expected) and treats zero rows as { ok: false }, and inserts with rev 1 when expectedRev is 0 (a unique violation is { ok: false })`. Run `pnpm --filter @ptcg/web exec vitest run test/cloud-api.test.ts` — Expected: FAIL (modules missing).
- [ ] **Step 2: Install** `pnpm --filter @ptcg/web add @supabase/supabase-js`; commit the lockfile with the task.
- [ ] **Step 3: Implement** the files above. `createSupabaseApi` maps by matching the error message/status (a `mapError(e: unknown): CloudError` helper in `supabaseApi.ts`); `saveSave` uses `from('player_saves')` insert/update with `.select()` so zero affected rows is detectable.
- [ ] **Step 4: Verify**: the test file passes; `pnpm typecheck` clean (the real client is only type-checked, never called).
- [ ] **Step 5: Commit** `feat(web): the cloud API seam, config and Supabase implementation`.

### Task 2: The `useCloud` auth store

**Files:**

- Create: `apps/web/src/cloud/useCloud.ts`
- Test: `apps/web/test/cloud-auth.test.ts`

**Interfaces:**

- Consumes: `CloudApi`, `CloudError`, `friendlyMessage`, `cloudConfig`, `loadSupabaseApi`, `createFakeCloud` (tests).
- Produces (`useCloud`, Zustand): state `{ enabled: boolean; ready: boolean; user: CloudUser | null; recovering: boolean; busy: boolean; error: string | null; notice: string | null }`; actions `init(api?: CloudApi | null): Promise<void>` (resolves the API from the argument, else `cloudConfig()` + `loadSupabaseApi`; with no API `enabled = false`; otherwise reads `getUser()` and subscribes to `onAuthChange`), `signUp(email, password): Promise<void>` (sets `notice: "Check your email to confirm your account."` when confirmation is needed), `signIn`, `signOut`, `requestReset(email)` (`notice: "If that email has an account, a reset link is on its way."`), `setNewPassword(password)` (clears `recovering`), `clearMessages()`. Validation happens here: `validateCredentials(email, password): string | null` exported ("Enter a valid email." / "Use at least 8 characters."). `reset()` for tests. A `passwordRecovery` event sets `recovering: true`.

- [ ] **Step 1: Failing tests**: `with no API the store is disabled and makes no calls`; `init restores a signed-in user and follows sign-out events`; `signUp validates, then reports the confirmation notice; a taken email shows "That email is already in use."`; `signIn with a wrong password shows "Wrong email or password." and stays signed out`; `signOut clears the user`; `requestReset always shows the same notice, even for an unknown email`; `a passwordRecovery event sets recovering and setNewPassword clears it`; `busy is true while a call is in flight and false after, including after an error`. Run — Expected: FAIL.
- [ ] **Step 2: Implement** `useCloud.ts` (a thin store over `CloudApi`; every action catches `CloudError` and stores `friendlyMessage(code)`; unknown errors become the "unknown" message).
- [ ] **Step 3: Verify** `pnpm --filter @ptcg/web exec vitest run test/cloud-auth.test.ts` — Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): the useCloud auth store`.

### Task 3: Options → Account section

**Files:**

- Create: `apps/web/src/ui/account/AccountSection.tsx`, `apps/web/src/ui/account/AuthForm.tsx`
- Modify: `apps/web/src/screens/Options.tsx` (render `<AccountSection />` as a `Box` above the Collector mode row), `apps/web/src/App.tsx` (call `useCloud.getState().init()` once, next to the profile init)
- Test: `apps/web/test/account-screen.test.tsx`

**Interfaces:**

- Consumes: `useCloud` (Task 2).
- Produces: `AccountSection` — returns `null` when `!enabled`. Signed out: a line "An account saves your progress online so you can play on any device." and two buttons "Create account" and "Sign in" that open `AuthForm` (`mode: 'signUp' | 'signIn'`, email and password fields labelled "Email" and "Password", a submit button named like the mode, a "Forgot password?" button in sign-in mode, inline `role="alert"` error and a `role="status"` notice). Signed in: "Signed in as <email>" and a "Sign out" button. (The sync status line is added in Task 8.)

- [ ] **Step 1: Failing tests**: `the section is absent when the cloud is not configured`; `signed out it explains accounts and offers Create account and Sign in`; `Create account validates the fields and shows the confirmation notice`; `a failed sign-in shows the error in an alert and keeps the form`; `signing in shows the email and a Sign out button, which signs out`; `Forgot password sends a reset and shows the notice`; `Options still shows every existing control (sound, theme, animations, Collector mode, name, Replay intro)`. Use `useCloud.getState().init(fakeApi)` in each test. Run — Expected: FAIL.
- [ ] **Step 2: Implement** the components with the existing retro `Box` / `Button` and the Options styling; inputs `min-w-0` so phone width never scrolls sideways.
- [ ] **Step 3: Verify** `pnpm --filter @ptcg/web exec vitest run test/account-screen.test.tsx` plus every existing test that renders Options (`grep -ln Options apps/web/test`) — Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): Options → Account section`.

### Task 4: Password recovery, setup files and a hidden-by-default build

**Files:**

- Create: `apps/web/src/ui/account/RecoveryDialog.tsx`, `supabase/migrations/001_player_saves.sql`, `docs/accounts-setup.md`
- Modify: `apps/web/src/App.tsx` (render `<RecoveryDialog />` when `useCloud` is `recovering`)
- Test: `apps/web/test/account-recovery.test.tsx`

**Interfaces:**

- Consumes: `useCloud.recovering`, `setNewPassword`, `validateCredentials`.
- Produces: `RecoveryDialog` — a blocking dialog "Choose a new password" with a "New password" field, "Save password" button, validation and error text, and a success notice "Password updated. You are signed in."; an invalid or expired link (`CloudError('invalidLink')` from `updatePassword`) shows "That link has expired. Ask for a new one." The migration creates the table exactly as in Global Constraints, enables row-level security and adds the three policies (select, insert with check, update using + with check, all `user_id = auth.uid()`). `docs/accounts-setup.md` lists the player's setup steps in order: create the Supabase project; run the migration in the SQL editor; Auth → turn on email confirmation; Auth → URL configuration: site URL and redirect URL = the Vercel domain (and `http://localhost:5173` for development); copy the project URL and anon key; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel (Production and Preview) and a local `apps/web/.env.local`; redeploy; note the free-plan pause after 7 days without database activity.

- [ ] **Step 1: Failing tests**: `a recovery event opens the Choose a new password dialog and blocks the rest of the app`; `a short password shows "Use at least 8 characters." and keeps the dialog`; `saving closes the dialog and shows the signed-in state`; `an expired link shows the plain message`. Run — Expected: FAIL.
- [ ] **Step 2: Implement** the dialog; write the SQL and the setup doc (no code test for those; Task 5 reviews them).
- [ ] **Step 3: Verify** `pnpm --filter @ptcg/web exec vitest run test/account-recovery.test.tsx` — Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): password recovery dialog, migration and setup guide`.

### Task 5: E2E and gate for 4a

**Files:** Modify `apps/web/src/main.tsx` (under the existing `?e2e` flag: with `?cloud=fake`, call `useCloud.getState().init(fake.api)` and expose `window.__cloudFake`), `apps/web/e2e/accounts.spec.ts` (create).

- [ ] **Step 1: E2E** at 390 and 1400 px with `?e2e&cloud=fake`: Options shows the Account section; create an account (the fake confirms through `window.__cloudFake.server.users`), sign in, see "Signed in as …", sign out; trigger `__cloudFake.emit('passwordRecovery')` and set a new password; no sideways scroll on any state; and **without** `?cloud=fake` the Account section is absent and the game starts as today.
- [ ] **Step 2: Gate**: `pnpm typecheck`, `pnpm exec eslint .`, `pnpm test`, the Playwright run (`pkill -f "[v]ite preview"` first, `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) — Expected: all green. Check the bundle: the main chunk does not contain `@supabase` (dynamic import).
- [ ] **Step 3: Commit** `test(e2e): accounts at phone and desktop widths`. Then the final Opus review of 4a (Review Focus items 4 and 5), one fix pass, PR **4a** ("Accounts: sign up, sign in and password reset (part 4a)"), subscribe, ask before merging, deploy check, branch reset.

---

## 4b — Sync

### Task 6: Pure sync decisions and the device link

**Files:**

- Create: `apps/web/src/cloud/sync.ts`, `apps/web/src/cloud/link.ts`
- Test: `apps/web/test/cloud-sync.test.ts`

**Interfaces:**

- Produces (`link.ts`): `interface CloudLink { userId: string; rev: number; dirty: boolean }`; `loadLink(): CloudLink | null`, `saveLink(l: CloudLink | null): void` (localStorage key `ptcg.cloud`, every access in try/catch, a malformed value is `null`). The link is per device and is **not** part of the `Profile`.
- Produces (`sync.ts`): `type SyncDecision = 'upload' | 'takeCloud' | 'ask' | 'push' | 'inSync'`; `hasProgress(p: Profile): boolean` (true when `introDone` or the collection is non-empty); `decide(o: { userId: string; local: Profile; link: CloudLink | null; cloud: { rev: number } | null }): SyncDecision` with the rules: no cloud row → `'upload'`; same-user link: `cloud.rev === link.rev` → `dirty ? 'push' : 'inSync'`, `cloud.rev > link.rev` → `dirty ? 'ask' : 'takeCloud'`; no link or another user's link: `hasProgress(local) ? 'ask' : 'takeCloud'`; `summarise(p: Profile): { name: string; credits: number; cards: number; badges: number }` (cards = different cards owned, badges = Gym badges) for the choice dialog.

- [ ] **Step 1: Failing tests** (names are the assertions): `no cloud row uploads`; `same account, same rev, clean → inSync; dirty → push`; `same account, newer cloud rev, clean → takeCloud; dirty → ask`; `another account's link with progress → ask (never upload)`; `another account's link with a brand-new local save → takeCloud`; `no link and a brand-new local save → takeCloud; with progress → ask`; `hasProgress is false for newProfile() and true after the intro or one card`; `summarise counts distinct cards and badges`; `loadLink returns null for missing, malformed or wrong-shaped values and survives a throwing localStorage`. Run `pnpm --filter @ptcg/web exec vitest run test/cloud-sync.test.ts` — Expected: FAIL.
- [ ] **Step 2: Implement** both files.
- [ ] **Step 3: Verify** the test file passes — Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): pure sync decisions and the device link`.

### Task 7: The sync engine in `useCloud` (push, pull, conflicts)

**Files:**

- Modify: `apps/web/src/cloud/useCloud.ts`, `apps/web/src/profile/useProfile.ts` (add `replaceProfile`)
- Test: `apps/web/test/cloud-engine.test.ts`, `apps/web/test/profile-replace.test.ts`

**Interfaces:**

- Consumes: Tasks 1, 2, 6.
- Produces (`useProfile`): `replaceProfile(p: Profile): Promise<void>` — runs through the `change` queue, normalises with `normalizeProfile`, saves to the local store and sets the profile (an explicit replacement, the only place the local save is overwritten by the cloud).
- Produces (`useCloud` additions): state `sync: 'off' | 'idle' | 'saving' | 'saved' | 'offline' | 'error'`, `savedAt: number | null`, `choice: null | { local: ProfileSummary; cloud: ProfileSummary; cloudProfile: Profile; cloudRev: number }`; actions `resolveChoice(keep: 'local' | 'cloud'): Promise<void>` and `syncNow(): Promise<void>`. Behaviour: after sign-in (and on app start with a restored session) run `decide`, then `'upload'` → `saveSave(local, 0)`; `'takeCloud'` → `replaceProfile(cloud)` and link `{ userId, rev, dirty: false }`; `'ask'` → set `choice` (play blocked by Task 8); `'push'` → push; `'inSync'` → nothing. A `useProfile.subscribe` on `profile` marks the link `dirty` and schedules a push after **2 seconds** of quiet (debounced) and flushes immediately on `visibilitychange` to hidden and `pagehide`; a push sends the current profile with the link's `rev`, on `{ ok: true, rev }` stores `{ rev, dirty: false }` and `sync: 'saved'`, on `{ ok: false }` loads the cloud save and runs `decide` again (which asks). A `CloudError('network')` sets `sync: 'offline'`, any other error sets `sync: 'error'` plus the friendly message; both keep `dirty: true` and retry on the next change, on `online`, and every 60 seconds while dirty. `resolveChoice('local')` pushes the local save with the cloud's rev (overwriting the cloud row); `'cloud'` calls `replaceProfile(cloudProfile)`. Sign-out stops timers, clears pending pushes, keeps the local save and sets `sync: 'off'` (the link is kept for the same-account check).

- [ ] **Step 1: Failing tests** (`cloud-engine.test.ts`, fake cloud + memory profile store + fake timers): `first sign-in with no cloud row uploads the local save at rev 1`; `first sign-in on a brand-new device takes the cloud save`; `a device with progress and an existing cloud row asks, and nothing is overwritten until answered`; `keep this device overwrites the cloud row, keep cloud replaces the local save`; `a change is pushed once after two quiet seconds, not on every change`; `the page going hidden flushes a pending push at once`; `a push with a stale rev does not overwrite and ends in a choice` (Review Focus 3); `signing in as another account on a device linked to the first asks and never writes the first account's save into the new row` (Review Focus 2); `offline: the local save is untouched, sync is offline, the push is retried after the next change and after the online event` (Review Focus 1); `a failed pull leaves the local profile as it was`; `an unavailable service keeps play working and shows the error`; `sign-out stops pushing and keeps the local save`; `with no API nothing subscribes and no timers are set` (Review Focus 4). `profile-replace.test.ts`: `replaceProfile normalises, saves and shows the profile`; `replaceProfile runs after earlier queued changes`. Run — Expected: FAIL.
- [ ] **Step 2: Implement** `replaceProfile`, then the engine (keep it in a separate `cloud/engine.ts` imported by `useCloud` if `useCloud.ts` would pass roughly 250 lines).
- [ ] **Step 3: Verify** `pnpm --filter @ptcg/web exec vitest run test/cloud-engine.test.ts test/profile-replace.test.ts test/cloud-auth.test.ts` and the existing profile tests (`test/profile*.test.ts*`) — Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): cloud sync engine and replaceProfile`.

### Task 8: The "which save?" dialog and the status line

**Files:**

- Create: `apps/web/src/ui/account/ChoiceDialog.tsx`
- Modify: `apps/web/src/ui/account/AccountSection.tsx` (status line), `apps/web/src/App.tsx` (render `<ChoiceDialog />` above everything when `choice` is set)
- Test: `apps/web/test/account-sync-ui.test.tsx`

**Interfaces:**

- Consumes: `useCloud.choice`, `resolveChoice`, `sync`, `savedAt`, `error`; `summarise` output.
- Produces: `ChoiceDialog` — a blocking `role="dialog"` named "Which save do you want to keep?" showing two cards, "This device" and "Your account", each with name, credits, cards owned and badges, and buttons "Keep this device" and "Keep my account's save"; it cannot be dismissed. The Account status line (`role="status"`): "Saved to your account · 2:41 PM", "Saving…", "Offline: will sync later" or the error text; absent when signed out.

- [ ] **Step 1: Failing tests**: `the dialog shows both saves with their credits, cards and badges`; `Keep this device and Keep my account's save call resolveChoice with the right side and close the dialog`; `the dialog has no close or Escape path`; `the status line shows each state: saving, saved with the time, offline, error`; `no status line when signed out`; `the rest of the app is inert behind the dialog`. Run — Expected: FAIL.
- [ ] **Step 2: Implement** the dialog (reuse the existing blocking-dialog styling from `RecoveryDialog`/`PassDevice`) and the status line.
- [ ] **Step 3: Verify** `pnpm --filter @ptcg/web exec vitest run test/account-sync-ui.test.tsx test/account-screen.test.tsx` — Expected: PASS.
- [ ] **Step 4: Commit** `feat(web): the which-save dialog and the sync status line`.

### Task 9: E2E for sync

**Files:** Modify `apps/web/e2e/accounts.spec.ts`.

- [ ] **Step 1: E2E** at 390 and 1400 px with `?e2e&cloud=fake` and a shared fake server (`__cloudFake.server.saves`): (a) sign in on a fresh device with a seeded cloud save → the game shows the cloud save's credits with no question; (b) sign in on a device that already has progress and a different cloud save → the dialog appears (no sideways scroll), "Keep my account's save" changes the credits shown in the town status, reload keeps the choice; (c) change something (open a pack) → after the debounce the fake server's `rev` increased; (d) set `server.offline = true`, change something, status says "Offline: will sync later", clear it and the push arrives; (e) signing out then signing in as another account asks.
- [ ] **Step 2: Gate**: `pnpm typecheck`, `pnpm exec eslint .`, `pnpm test`, the Playwright run — Expected: all green.
- [ ] **Step 3: Commit** `test(e2e): account sync, conflicts and offline`.

### Task 10: Real-project checklist and gate for 4b

**Files:** Modify `docs/accounts-setup.md` (add "Check it works" steps).

- [ ] **Step 1: Document** the manual checklist the player runs against the real project (sign up, confirm the email, sign in on a second browser, change something, see it arrive; reset a password; what the paused-project state looks like and how to restart it) and put the same list in the PR description.
- [ ] **Step 2: Final**: Opus review of the whole of 4b (all five Review Focus items), one fix pass with RED→GREEN tests, PR **4b** ("Accounts: cloud sync (part 4b)"), subscribe, ask before merging, deploy check, branch reset. The real Supabase project and variables are the player's setup; until set, production behaves as signed out.
- [ ] **Step 3: Commit** `docs: accounts checklist`.
