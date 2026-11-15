-- Calendar feed: remember which kind of calendar read the link last (Apple Calendar vs Google Calendar), so the
-- "ปฏิทิน iPhone" and "Google Calendar" cards can each show their own status. Run once; safe to re-run.
alter table public.cal_tokens add column if not exists last_apple_at timestamptz, add column if not exists last_google_at timestamptz;

create or replace function public.create_cal_token() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text;
begin
  if auth.uid() is null or not public.is_approved() then raise exception 'not approved'; end if;
  t := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.cal_tokens(user_id, token_hash) values (auth.uid(), encode(extensions.digest(t, 'sha256'), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now(), last_used_at = null, last_apple_at = null, last_google_at = null;
  return t;
end $$;

create or replace function public.cal_token_status() returns json
language sql security definer set search_path = public as $$
  select json_build_object('created_at', created_at, 'last_used_at', last_used_at, 'last_apple_at', last_apple_at, 'last_google_at', last_google_at)
  from public.cal_tokens where user_id = auth.uid();
$$;
