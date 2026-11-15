-- CoolCrew / TG Crew: personal calendar subscription link (15 Nov 2026). Run once; safe to re-run.
-- The iPhone Calendar subscribes to alarm-feed?c=<token> (an .ics feed) and refreshes by itself, so the calendar follows
-- every roster update with no button. Separate from alarm_tokens so making a calendar link never breaks the alarm Shortcut.
-- Only the SHA-256 of the token is stored; the member sees the plain token once.
create table if not exists public.cal_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.cal_tokens enable row level security;
revoke all on public.cal_tokens from anon, authenticated;

create or replace function public.create_cal_token() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text;
begin
  if auth.uid() is null or not public.is_approved() then raise exception 'not approved'; end if;
  t := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.cal_tokens(user_id, token_hash) values (auth.uid(), encode(extensions.digest(t, 'sha256'), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now(), last_used_at = null;
  return t;   -- a new call replaces (and kills) the old link
end $$;

create or replace function public.cal_token_status() returns json
language sql security definer set search_path = public as $$
  select json_build_object('created_at', created_at, 'last_used_at', last_used_at) from public.cal_tokens where user_id = auth.uid();
$$;

create or replace function public.revoke_cal_token() returns void
language sql security definer set search_path = public as $$
  delete from public.cal_tokens where user_id = auth.uid();
$$;

revoke all on function public.create_cal_token() from public, anon;
revoke all on function public.cal_token_status() from public, anon;
revoke all on function public.revoke_cal_token() from public, anon;
grant execute on function public.create_cal_token() to authenticated;
grant execute on function public.cal_token_status() to authenticated;
grant execute on function public.revoke_cal_token() to authenticated;
