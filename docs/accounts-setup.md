# Setting up account saves

Accounts are optional. Until you finish these steps the game works exactly as before (signed out, saves in the
browser) and the Account section in Options is hidden. You do these steps once; they take about ten minutes.

1. **Create a Supabase project** at supabase.com (the free plan is enough). Note the database password somewhere safe.
2. **Create the save table.** In the project, open SQL editor, paste the contents of
   `supabase/migrations/001_player_saves.sql` and run it. It creates `player_saves` so each player can only read and
   write their own row.
3. **Turn on email confirmation.** Authentication → Providers → Email: keep "Confirm email" on.
4. **Tell Supabase where the game lives.** Authentication → URL configuration: set the Site URL to your game's
   address (for example `https://ptcg-web-pi.vercel.app`) and add it, plus `http://localhost:5173` for development,
   to the Redirect URLs. Confirmation and password-reset links come back to this address.
5. **Copy the project URL and the anon key.** Project settings → API: the Project URL and the `anon` public key. Both
   are meant to be public; the table's row rules are what protect each save.
6. **Give them to the game.** In Vercel (project `ptcg-web`) → Settings → Environment Variables add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production and Preview, then redeploy. For development put
   the same two lines in `apps/web/.env.local`.

## Good to know

- On Supabase's free plan a project with no database activity for 7 days is paused. Saves then fail with "The
  account service is unavailable right now" and play carries on from the browser save. Restart the project from the
  Supabase dashboard and the next save catches up.
- Assume the free plan has no backups.
- The Options → Account section only shows when both variables are set.
