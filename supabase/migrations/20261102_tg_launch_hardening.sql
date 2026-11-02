-- CoolCrew: hardening before opening tgcrew.web.app (2 Nov 2026). Run once in Supabase SQL Editor. Safe to re-run.
-- 1. Swap offers follow the member's REAL airline. The owner's "view airline" (set_view_airline) is for looking only:
--    the owner's pilot account cannot offer on a TG crew post, even when calling the API directly.
-- 2. Feedback: an admin reads only feedback from members of the airline they are looking at.
-- 3. Helper functions used by row-level security are not callable without signing in.

create or replace function public.real_same_airline(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p
                where p.id = uid and p.airline = (select me.airline from public.profiles me where me.id = auth.uid()));
$$;
revoke all on function public.real_same_airline(uuid) from public, anon;
grant execute on function public.real_same_airline(uuid) to authenticated;

drop policy if exists offers_insert on public.offers;
create policy offers_insert on public.offers for insert to authenticated
  with check (offered_by = (select auth.uid()) and (select public.is_approved())
    and exists (select 1 from public.posts p where p.id = offers.post_id and p.status = 'open'
                and p.author <> (select auth.uid()) and public.real_same_airline(p.author)));

drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback for select to authenticated
  using ((select public.is_admin()) and public.same_airline(user_id));

revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.is_approved() from anon, public;
revoke execute on function public.my_airline() from anon, public;
revoke execute on function public.same_airline(uuid) from anon, public;
revoke execute on function public.set_view_airline(text) from anon, public;
revoke execute on function public.admin_login_stats() from anon, public;
grant execute on function public.is_admin(), public.is_approved(), public.my_airline(), public.same_airline(uuid),
  public.set_view_airline(text), public.admin_login_stats() to authenticated;

select 'ok' as done;
