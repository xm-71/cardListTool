# M2 — Game Board UI + Easy Bot + First Vercel Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a full Pokémon TCG game in the browser against the Easy bot, or hotseat, using the M1 engine and the two Mega Battle Decks, deployed on Vercel.

**Architecture:** `apps/web` is a Vite + React SPA that imports `@ptcg/engine`, `@ptcg/cards` and `@ptcg/bots` directly. All game logic runs in the browser.

- A Zustand store holds the `GameState` and applies actions through the engine.
- The UI renders only `engine.viewFor(state, viewer)` and offers only moves from `getLegalActions`.
- The bot runs in a Web Worker. A driver hook asks it for a move whenever the acting player is the bot, with a short delay so a human can follow the game.

**Tech Stack:** React 19, Vite 6, TypeScript 5 (strict), Tailwind CSS 4, Zustand 5, Vitest + Testing Library (jsdom), Playwright (smoke test), Vercel (static hosting, Git-linked).

**Spec:** `docs/superpowers/specs/2026-10-08-pokemon-tcg-browser-game-design.md` (§4.3 Bots, §4.5 Web app, §5 Error handling, §6 Testing, §7 Deployment).

## Global Constraints

- The UI never builds actions itself. Every clickable move is an `Action` taken from `engine.getLegalActions(state, actor)`.
- The UI renders from `PlayerView` only, never from raw `GameState`, so hidden information stays hidden. That applies to bot games, and in hotseat to whoever's turn it is.
- Card images load from TCGdex: `${def.image}/low.webp` for the board and `${def.image}/high.webp` for the zoom preview. A failed load falls back to a text-rendered card (spec §4.2).
- A card effect that throws must not white-screen the app. Show "Something went wrong", plus a button that downloads `{ seed, decks, actions }` as JSON (spec §5).
- Desktop first; layout must remain usable at 768 px wide.
- Private-use notice in the footer (spec §1).
- Bot action delay: 700 ms between bot actions.

## Review Focus

1. **Bot turn never starts or never stops.** The bot is the acting player because of a _prompt_ during the human's turn (e.g. a promotion after the human Knocks Out its Active). Expected: the bot answers the prompt and control returns to the human. _(Task 6.)_
2. **Hotseat hand leakage.** Turns pass, and a prompt goes to the non-current player. Expected: the pass-device screen appears whenever the acting player changes, and the board stays hidden until it's confirmed. _(Task 6.)_
3. **Stale clicks.** A double click or a click during a bot's move dispatches an action that is no longer legal. Expected: the store ignores it (catches `IllegalActionError`) without changing state. _(Task 2.)_
4. **Images unavailable.** TCGdex is down or slow. Expected: the text card fallback renders, with name, HP and attacks readable. _(Task 4.)_
5. **Game over.** No further actions are offered, the result overlay shows the winner and reason, and "Play again" starts a fresh game. _(Task 6.)_

---

## File Structure

```
apps/web/
  index.html, vite.config.ts, tsconfig.json, package.json, vitest.setup.ts
  src/main.tsx, src/App.tsx, src/index.css
  src/game/catalog.ts       engine + registry singletons, deck catalog
  src/game/store.ts         Zustand game store
  src/game/actions.ts       describeAction, actionsForCard, actionsForSlot
  src/game/botClient.ts     Web Worker wrapper (+ sync fallback for tests)
  src/game/bot.worker.ts    worker: createEasyBot
  src/game/useBotDriver.ts  drives bot turns
  src/ui/CardView.tsx, CardPreview.tsx, SlotView.tsx, Side.tsx, Hand.tsx, Board.tsx,
  src/ui/ActionMenu.tsx, PromptPanel.tsx, GameLog.tsx, PassDevice.tsx, GameOver.tsx
  src/screens/Home.tsx, src/screens/GameScreen.tsx
  test/*.test.ts(x), e2e/smoke.spec.ts, playwright.config.ts
```

### Task 1: Scaffold apps/web

**Files:** Create everything under `apps/web` listed for this task. Modify root `package.json` (typecheck includes `apps/web`) and `vitest.config.ts` (projects include `apps/*`).

**Interfaces:** Produces the `@ptcg/web` package (scripts: `dev`, `build`, `preview`, `test`, `e2e`).

- [ ] **Step 1:** Failing test `test/app.test.tsx`: rendering `<App/>` shows the heading "Pokémon TCG" and a "Play" button.
- [ ] **Step 2:** Run it, expect FAIL.
- [ ] **Step 3:** Scaffold Vite React TS, Tailwind 4 (`@tailwindcss/vite`), and Vitest with the jsdom environment and `@testing-library/jest-dom`. Write a minimal `App`.
- [ ] **Step 4:** `pnpm --filter @ptcg/web test` PASS. `pnpm --filter @ptcg/web build` produces `dist/`. Then `pnpm check` PASS.
- [ ] **Step 5:** Commit `feat(web): scaffold Vite React app`.

### Task 2: Game store

**Files:** `src/game/catalog.ts`, `src/game/store.ts`, `test/store.test.ts`

**Interfaces:**

- `catalog.ts`:
  - `registry`, `engine`;
  - `DECKS: { id: 'mega-gengar' | 'mega-diancie'; name: string; list: DeckList; type: EnergyType }[]`.
- `store.ts`: `useGame` (Zustand) with state `{ state: GameState | null; mode: 'bot' | 'hotseat'; human: PlayerId; config: GameConfig | null; actions: Action[]; error: string | null }` and these methods:
  - `start(cfg: GameConfig)`, where `GameConfig = { mode; humanDeck: DeckId; botDeck: DeckId; seed: number }`. The human is seat 0 in bot mode.
  - `dispatch(player: PlayerId, action: Action): void`. Applies the action, appends to `actions`, swallows `IllegalActionError` (the state is unchanged), and records other errors in `error`.
  - `reset()`.
- Selectors (pure, exported): `actorOf(state): PlayerId | null` returns the prompt player, else the current player, else null when the game is over. `viewerOf(store)` returns `human` in bot mode and `actorOf` in hotseat.

- [ ] **Step 1: Failing tests:**
  - `start` creates a game in setup with a prompt for seat 0;
  - `dispatch` of a legal answer advances the game;
  - **(RF3)** dispatching an illegal action leaves `state` identical (`toBe` the same object) and `error === null`;
  - `actorOf` follows prompts (setup prompt → its player);
  - an error thrown by the engine for a non-illegal reason is stored in `error`, simulated by dispatching on a corrupted state.
- [ ] **Step 2:** Run, FAIL. **Step 3:** Implement. **Step 4:** Run, PASS. **Step 5:** Commit `feat(web): game store`.

### Task 3: Action helpers

**Files:** `src/game/actions.ts`, `test/actions.test.ts`

**Interfaces:**

- `describeAction(a: Action, view: PlayerView): string`. Examples: "Play Nest Ball", "Attach Darkness Energy to Gastly", "Evolve Gastly into Haunter", "Retreat to Seviper", "Attack: Void Gale (230)", "Use Sinister Surge", "Use Mystery Garden", "End turn", "Done".
- `actionsForCard(legal: Action[], uid: string): Action[]` returns actions whose `uid` is this card (hand cards).
- `actionsForSlot(legal, ref): Action[]` returns `evolve`/`attachEnergy`/`playTrainer` actions targeting the slot, plus `useAbility` on it, plus `attack`/`retreat` when the ref is the actor's Active.
- `globalActions(legal): Action[]` returns `endTurn`, `useStadium` and `concede`.

- [ ] **Step 1: Failing tests:** using a real started game, each label above is produced for the matching action (the attack label includes base damage and uses `+`/`×` suffixes). `actionsForCard` of a hand Basic contains its `playBasic`. `actionsForSlot` of the Active contains attacks once Energy is attached.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(web): action labels and grouping`.

### Task 4: Card and slot rendering

**Files:** `src/ui/CardView.tsx`, `src/ui/CardPreview.tsx`, `src/ui/SlotView.tsx`, `test/cards.test.tsx`

**Interfaces:**

- `<CardView card={CardInstance} size="sm"|"md" onClick? highlighted? />` renders an `<img>` and, on `onError`, a `<TextCard def>` showing name, HP, types, attacks (cost, damage) and the effect/ability text.
- `<CardPreview card>` is the large zoom shown on hover.
- `<SlotView slot={SlotView} onClick? highlighted?>` shows the top card, damage as "HP left / max" with a red badge, Energy chips coloured by type, the Tool name, condition badges, and the evolution stack count.

- [ ] **Step 1: Failing tests:**
  - **(RF4)** after firing `error` on the image, the card name, HP and first attack name are visible as text;
  - `SlotView` with damage 50 on a 70-HP Pokémon shows "20/70";
  - a slot with poison shows a "Poisoned" badge.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(web): card and slot views`.

### Task 5: Board, hand, prompts, action menu

**Files:** `src/ui/Side.tsx`, `Hand.tsx`, `Board.tsx`, `ActionMenu.tsx`, `PromptPanel.tsx`, `GameLog.tsx`, `src/screens/GameScreen.tsx`, `test/board.test.tsx`

**Interfaces:**

- `<Board view legal onAction(action)>` lays out the opponent on top (Active, Bench ×5, Prizes count, deck count, discard pile with the top card and count) and you below, with the Stadium in the middle.
- Clicking a hand card or a slot with actions opens `<ActionMenu actions view onPick>` (a popover listing `describeAction` labels).
- A sidebar holds the "End turn" button, `useStadium`, Concede (with confirm), and `<GameLog>`, which shows the last 200 events, newest at the bottom, auto-scrolled.
- `<PromptPanel prompt view onAnswer>` is a modal with the prompt message and the options. Card options render as `CardView`s, slot options as their Pokémon, plain options as buttons. It shows "Selected k of max (min …)" and a Done button when `'done'` is legal.
- When `view.waitingOn` is set, the panel shows "Waiting for opponent…" instead.

- [ ] **Step 1: Failing tests:**
  - a started bot-mode game at the setup prompt renders the PromptPanel with the human's Basics; clicking one dispatches its answer;
  - in the main phase, clicking a hand Basic shows "Play <name>" and clicking it moves the card to the Bench;
  - the opponent's hand renders only as a count (no card names from it in the DOM).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(web): board, hand, prompts and action menu`.

### Task 6: Home, bot worker and driver, hotseat, game over

**Files:** `src/screens/Home.tsx`, `src/game/bot.worker.ts`, `src/game/botClient.ts`, `src/game/useBotDriver.ts`, `src/ui/PassDevice.tsx`, `src/ui/GameOver.tsx`, `src/ui/ErrorBoundary.tsx`, `test/flow.test.tsx`

**Interfaces:**

- `BotClient = { choose(view: PlayerView, legal: Action[], rng: number): Promise<{ action: Action; rng: number }> }`. `createWorkerBotClient()` uses `new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' })`. `createSyncBotClient()` calls `createEasyBot(registry)` directly, for tests and as a fallback when `Worker` is undefined.
- `useBotDriver(client, delayMs)`: when `mode === 'bot'`, there is no result, and `actorOf(state) === 1 - human`, it waits `delayMs`, asks the client, then dispatches. It re-arms whenever the state changes, and a sequence counter drops stale replies.
- **Home:**
  - Opponent: "Easy bot" or "Hotseat (2 players, 1 device)".
  - "Your deck" picks one of the two decks; the bot or Player 2 gets the other.
  - "Start" calls `start({…, seed: Date.now() >>> 0})`.
- **PassDevice** (hotseat): shown whenever the actor differs from the last confirmed viewer, as a full-screen "Pass to Player N" overlay with a "Ready" button.
- **GameOver:** overlay with "You win!" / "You lose" / "Player N wins" / "Draw", the reason, "Play again" (same settings, new seed) and "Home".
- **ErrorBoundary + store error:** shows "Something went wrong" and a "Download bug report" button, which saves `{ config, actions, error }`.

- [ ] **Step 1: Failing tests** (fake timers, sync bot client, delay 0):
  - starting a bot game and finishing the human setup prompt leads to the bot completing its own setup automatically;
  - after the human ends their turn, the bot plays until the actor is the human again or the game ends (bounded by 200 steps);
  - **(RF1)** if a human action Knocks Out the bot's Active and the bot has 2+ Benched, the bot answers the promotion prompt and the actor returns to the human;
  - **(RF2)** in hotseat, after the setup prompt passes from seat 0 to seat 1, the PassDevice overlay is shown and seat 0's hand is not in the DOM;
  - **(RF5)** a finished game shows GameOver, `legal` is empty, and "Play again" starts a new game in the setup phase.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(web): home screen, bot driver, hotseat, game over`.

### Task 7: Playwright smoke test and Vercel deployment

**Files:** `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`, `vercel.json` (if needed), `README.md`

- [ ] **Step 1: Smoke test:** build, then serve with `vite preview`. Open `/`, choose Easy bot, Start, then answer setup by clicking the first offered card (and Done if shown). Expect the board to be visible. Click "End turn" and expect the log to contain "Player 2" within 15 s. Use `executablePath: '/opt/pw-browsers/chromium'` if the pinned Playwright version has no matching browser.
- [ ] **Step 2:** Run `pnpm --filter @ptcg/web e2e`, expect PASS. Screenshot the board for the user.
- [ ] **Step 3:** Vercel: `create_git_project` for `xm-71/cardlisttool` on team `team_tA1CXALBXb1H42cSJKb6ukct`, project `ptcg-web`, `rootDirectory: apps/web`, framework vite. Push the branch, which triggers a preview deployment of `claude/kind-meitner-2p99da`. Inspect the deployment until it's `READY`; on `ERROR`, read the build logs and fix.
- [ ] **Step 4:** Confirm the preview URL serves the app (using an access link if Deployment Protection is on). Record the URL in the README.
- [ ] **Step 5:** Commit `chore: Playwright smoke test and Vercel deployment`.
