-- CoolCrew: LINE bot for the Thai Airways "Economy TG Crew" group (2 Nov 2026). Run once in Supabase SQL Editor. Safe to re-run.
-- 1. posts.line_from: which LINE member (hashed id) a bot post came from, so one member's repost updates their own post.
-- 2. line_seen: fingerprints of pictures already read (the group reposts the same pictures many times a day).
--    Only the line-ingest function (service role) uses it; members cannot read it.
-- 3. A TG bot account "LINE Bot TG" (no password, cannot sign in) that TG posts are written as, plus app_keys line_bot_author_TG.

alter table public.posts add column if not exists line_from text;
create index if not exists posts_line_from_idx on public.posts (author, line_from, date) where line_from is not null;

create table if not exists public.line_seen (
  fp text primary key,
  airline text not null default 'TG',
  seen_at timestamptz not null default now(),
  result jsonb
);
alter table public.line_seen enable row level security;
revoke all on public.line_seen from anon, authenticated;

do $$
declare uid uuid;
begin
  select id into uid from auth.users where email = 'linebot-tg@tgcrew.web.app';
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'linebot-tg@tgcrew.web.app', '',
            now(), '{"provider":"email","providers":["email"]}', '{"name":"LINE Bot TG"}', now(), now());
  end if;
  -- the profile row comes from the on_auth_user_created trigger; make it an approved TG member
  insert into public.profiles (id, display_name) values (uid, 'LINE Bot TG') on conflict (id) do nothing;
  update public.profiles set display_name = 'LINE Bot TG', airline = 'TG', rank = 'FA', fleet = 'TG',
         status = 'approved', employee_code = 'LINEBOT' where id = uid;
  insert into public.app_keys (name, value) values ('line_bot_author_TG', to_jsonb(uid::text))
    on conflict (name) do update set value = excluded.value;
end $$;

select p.display_name, p.airline, p.rank, p.status, (select value from public.app_keys where name = 'line_bot_author_TG') key
from public.profiles p join auth.users u on u.id = p.id where u.email = 'linebot-tg@tgcrew.web.app';
