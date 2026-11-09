-- Posts a member ticked "✓ อ่านแล้ว" (not interested) on the swap board: hidden for that account on every device.
-- Each member sees and changes only their own rows. Rows go away with the post (cascade) or the account.
create table if not exists public.post_reads (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists post_reads_post_id_idx on public.post_reads (post_id);

alter table public.post_reads enable row level security;

drop policy if exists post_reads_select on public.post_reads;
create policy post_reads_select on public.post_reads for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists post_reads_insert on public.post_reads;
create policy post_reads_insert on public.post_reads for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists post_reads_delete on public.post_reads;
create policy post_reads_delete on public.post_reads for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on public.post_reads to authenticated;
