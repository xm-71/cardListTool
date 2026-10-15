-- One cloud save per account: the player's profile JSON and a revision counter used to detect two devices
-- saving at once. Run this once in the Supabase SQL editor (see docs/accounts-setup.md).

create table if not exists public.player_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  rev integer not null,
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

-- A signed-in player can read, create and change only their own row.
create policy "read own save" on public.player_saves
  for select to authenticated
  using (user_id = auth.uid());

create policy "insert own save" on public.player_saves
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "update own save" on public.player_saves
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- New Supabase projects need the Data API grants spelled out.
grant select, insert, update on public.player_saves to authenticated;
