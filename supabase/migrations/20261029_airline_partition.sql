-- CoolCrew: one Supabase project, two airlines
--   TVJ = Thai VietJet pilots  (coolcrew.web.app)
--   TG  = Thai Airways cabin crew (tgcrew.web.app)
-- Members only ever see members, posts, offers and rosters of their own airline (also closes audit item SEC-007
-- across airlines). Every existing row becomes TVJ, so the current app behaves exactly as before.
-- Run once in Supabase Dashboard → SQL Editor (project devbnbshwsibjupesywi). Safe to re-run.

alter table public.profiles add column if not exists airline text not null default 'TVJ';
alter table public.profiles drop constraint if exists profiles_airline_check;
alter table public.profiles add constraint profiles_airline_check check (airline in ('TVJ','TG'));
alter table public.profiles drop constraint if exists profiles_rank_check;
alter table public.profiles add constraint profiles_rank_check check (rank in ('FO','SFO','CPT','IM','AP','FA'));
alter table public.profiles drop constraint if exists profiles_fleet_check;
alter table public.profiles add constraint profiles_fleet_check check (fleet in ('A320','B737','TG'));
alter table public.approval_tokens add column if not exists req_airline text;

create or replace function public.my_airline() returns text language sql stable security definer set search_path = public as $$
  select airline from public.profiles where id = auth.uid();
$$;
create or replace function public.same_airline(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = uid and p.airline = (select airline from public.profiles where id = auth.uid()));
$$;
revoke all on function public.my_airline() from public, anon;
grant execute on function public.my_airline() to authenticated;
revoke all on function public.same_airline(uuid) from public, anon;
grant execute on function public.same_airline(uuid) to authenticated;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or ((select public.is_approved()) and airline = (select public.my_airline())));
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select public.is_admin()) and airline = (select public.my_airline()))
  with check ((select public.is_admin()) and airline = (select public.my_airline()));
drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using ((select public.is_admin()) and id <> auth.uid() and airline = (select public.my_airline()));

-- posts
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated
  using ((select public.is_approved()) and public.same_airline(author));
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated
  using (author = (select auth.uid()) or ((select public.is_admin()) and public.same_airline(author)));

-- offers
drop policy if exists offers_select on public.offers;
create policy offers_select on public.offers for select to authenticated
  using ((select public.is_approved()) and public.same_airline(offered_by));
drop policy if exists offers_insert on public.offers;
create policy offers_insert on public.offers for insert to authenticated
  with check (offered_by = (select auth.uid()) and (select public.is_approved())
    and exists (select 1 from public.posts p where p.id = offers.post_id and p.status = 'open'
                and p.author <> (select auth.uid()) and public.same_airline(p.author)));
drop policy if exists offers_delete on public.offers;
create policy offers_delete on public.offers for delete to authenticated
  using (offered_by = (select auth.uid())
    or exists (select 1 from public.posts p where p.id = offers.post_id and p.author = (select auth.uid()))
    or ((select public.is_admin()) and public.same_airline(offered_by)));

-- rosters
drop policy if exists rosters_select on public.rosters;
create policy rosters_select on public.rosters for select to authenticated
  using ((select public.is_approved()) and public.same_airline(user_id));

-- flight_crew (TVJ LINE feed) is TVJ only
drop policy if exists "approved members read flight_crew" on public.flight_crew;
create policy "approved members read flight_crew" on public.flight_crew for select to authenticated
  using ((select public.is_approved()) and (select public.my_airline()) = 'TVJ');

-- airline and identity are frozen once approved (a pending applicant may still correct them)
create or replace function public.protect_profile() returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status   := old.status;
    new.is_admin := old.is_admin;
    if old.status = 'approved' then
      new.rank          := old.rank;
      new.fleet         := old.fleet;
      new.display_name  := old.display_name;
      new.employee_code := old.employee_code;
      new.airline       := old.airline;
    end if;
  end if;
  new.id := old.id;
  return new;
end $function$;

-- admin stats: own airline only
create or replace function public.admin_login_stats()
 returns table(id uuid, name text, status text, joined timestamp with time zone, last_sign_in timestamp with time zone, last_seen timestamp with time zone, days_30 integer, hits_30 integer, days jsonb)
 language plpgsql stable security definer set search_path to 'public', 'auth'
as $function$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  return query
  select p.id, p.display_name::text, p.status::text, u.created_at, u.last_sign_in_at,
         (select max(s.last_at) from public.member_seen s where s.user_id = p.id),
         (select count(*)::int from public.member_seen s where s.user_id = p.id and s.day > (now() at time zone 'Asia/Bangkok')::date - 30),
         (select coalesce(sum(s.hits),0)::int from public.member_seen s where s.user_id = p.id and s.day > (now() at time zone 'Asia/Bangkok')::date - 30),
         (select coalesce(jsonb_agg(s.day order by s.day), '[]'::jsonb) from public.member_seen s where s.user_id = p.id and s.day > (now() at time zone 'Asia/Bangkok')::date - 14)
  from public.profiles p left join auth.users u on u.id = p.id
  where p.airline = public.my_airline()
  order by u.last_sign_in_at desc nulls last;
end $function$;

-- roster-reading quota: the group limit counts reads of the same airline
create or replace function public.claim_roster_read(p_user uuid, p_user_limit integer, p_global_limit integer)
 returns text language plpgsql set search_path to 'public', 'pg_temp'
as $function$
declare n_user int; n_all int; a text;
begin
  perform pg_advisory_xact_lock(hashtext('public.roster_reads.quota'));
  select airline into a from public.profiles where id = p_user;
  select count(*) into n_user from public.roster_reads where user_id = p_user and created_at > now() - interval '24 hours';
  if n_user >= p_user_limit then return 'user_limit'; end if;
  select count(*) into n_all from public.roster_reads r join public.profiles p on p.id = r.user_id
    where r.created_at > now() - interval '24 hours' and p.airline = coalesce(a, 'TVJ');
  if n_all >= p_global_limit then return 'global_limit'; end if;
  insert into public.roster_reads(user_id) values (p_user);
  return 'ok';
end;
$function$;

-- approval link: per-airline site and wording (same ntfy topic: the owner approves both airlines)
create or replace function private.send_join_email(pid uuid)
 returns void language plpgsql security definer set search_path to 'public', 'private', 'extensions'
as $function$
declare p public.profiles; t uuid; topic text; url text; k text; site text; em text; link text; role text; app text;
begin
  select * into p from public.profiles where id = pid;
  if p.id is null then return; end if;
  select value into topic from private.settings where key = 'ntfy_topic';
  select value into url   from private.settings where key = 'notify_url';
  select value into k     from private.settings where key = 'notify_key';
  if p.airline = 'TG' then
    site := coalesce((select value from private.settings where key = 'site_url_TG'), 'https://tgcrew.web.app');
    app  := 'CoolCrew TG';
    role := 'การบินไทย ' || case p.rank when 'IM' then 'In-flight Manager' when 'AP' then 'Air Purser' when 'FA' then 'Flight Attendant' else coalesce(p.rank, '') end;
  else
    site := coalesce((select value from private.settings where key = 'site_url'), 'https://coolcrew.web.app');
    app  := 'CoolCrew';
    role := case when p.fleet = 'B737' then 'B737' else 'A320/A321' end || ' ' || case when p.rank = 'CPT' then 'Captain' else 'First Officer' end;
  end if;
  if topic is null and url is null then return; end if;
  insert into public.approval_tokens(profile_id, req_rank, req_fleet, req_code, req_airline)
    values (pid, p.rank, p.fleet, p.employee_code, p.airline) returning token into t;
  select email into em from auth.users where id = pid;
  link := site || '/approve.html?t=' || t;
  if topic is not null then
    perform net.http_post(url := 'https://ntfy.sh/', body := jsonb_build_object(
      'topic', topic,
      'title', app || ': ' || coalesce(p.display_name, '') || ' ขอเข้ากลุ่ม',
      'message', coalesce(p.employee_code, '') || ' · ' || role || ' · ' || coalesce(em, '') || E'\n' || 'แตะเพื่อตรวจและอนุมัติ (ไม่ต้องล็อกอิน)',
      'click', link, 'priority', 4,
      'tags', jsonb_build_array('airplane'),
      'actions', jsonb_build_array(jsonb_build_object('action', 'view', 'label', 'ตรวจและอนุมัติ', 'url', link))),
      headers := '{"Content-Type":"application/json"}'::jsonb);
  end if;
  if url is not null then
    perform net.http_post(url := url, body := jsonb_build_object('key', k, 'name', p.display_name, 'code', p.employee_code, 'rank', p.rank,
      'fleet', p.fleet, 'airline', p.airline, 'email', em, 'link', link, 'admin', site || '/#stats'), headers := '{"Content-Type":"application/json"}'::jsonb);
  end if;
end $function$;
