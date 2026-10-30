-- CoolCrew: the owner manages both airlines from one account.
-- profiles.is_owner marks the owner; profiles.view_airline is the airline the owner is looking at right now.
-- my_airline() returns view_airline for the owner, so every airline-scoped policy (members, posts, rosters, offers,
-- admin page, login stats) follows the site the owner opened: coolcrew.web.app = TVJ, tgcrew.web.app = TG.
-- The web app sets view_airline through set_view_airline() when the owner opens a site. Everyone else is unchanged.
-- Run once in Supabase Dashboard → SQL Editor (project devbnbshwsibjupesywi). Safe to re-run.

alter table public.profiles add column if not exists is_owner boolean not null default false;
alter table public.profiles add column if not exists view_airline text;
alter table public.profiles drop constraint if exists profiles_view_airline_check;
alter table public.profiles add constraint profiles_view_airline_check check (view_airline is null or view_airline in ('TVJ','TG'));

create or replace function public.my_airline() returns text language sql stable security definer set search_path = public as $$
  select case when p.is_owner and p.view_airline is not null then p.view_airline else p.airline end
  from public.profiles p where p.id = auth.uid();
$$;
create or replace function public.same_airline(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.id = uid and p.airline = public.my_airline());
$$;

-- only the owner may switch, and only to a known airline
create or replace function public.set_view_airline(a text) returns text language plpgsql security definer set search_path = public as $$
begin
  if a not in ('TVJ','TG') then raise exception 'bad airline'; end if;
  update public.profiles set view_airline = a where id = auth.uid() and is_owner;
  return public.my_airline();
end $$;
revoke all on function public.set_view_airline(text) from public, anon;
grant execute on function public.set_view_airline(text) to authenticated;

-- nobody can make themselves (or anyone) owner from the app; view_airline only for the owner
create or replace function public.protect_profile() returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if auth.uid() is not null then
    new.is_owner := old.is_owner;
    if not old.is_owner then new.view_airline := old.view_airline; end if;
  end if;
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

-- the owner: yuthachai.myl@gmail.com
update public.profiles set is_owner = true, view_airline = coalesce(view_airline, airline)
where id = (select id from auth.users where lower(email) = 'yuthachai.myl@gmail.com');

select display_name, airline, is_admin, is_owner, view_airline from public.profiles where is_owner;
