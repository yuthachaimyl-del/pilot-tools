-- Swap-board filter settings per account (aircraft ticks, ❌ ขขค / India-overnight / Europe filters), so they are the
-- same on every device signed in to that account. One row per member; each member reads and writes only their own.
create table if not exists public.board_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.board_prefs enable row level security;

drop policy if exists board_prefs_select on public.board_prefs;
create policy board_prefs_select on public.board_prefs for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists board_prefs_insert on public.board_prefs;
create policy board_prefs_insert on public.board_prefs for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists board_prefs_update on public.board_prefs;
create policy board_prefs_update on public.board_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update on public.board_prefs to authenticated;
