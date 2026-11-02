-- CoolCrew TG: aircraft type of a swap post (A350 / B787 ...) so members can hide types they are not qualified on.
-- Filled by the LINE bot when the picture shows it; null = unknown (still shown, labelled). Safe to re-run.
alter table public.posts add column if not exists ac_type text;
-- contact: LINE link of the poster, from the LINE ID or the LINE QR code on the picture (the TG group asks members
-- to put their LINE ID on swap pictures); shown only to approved TG members, like the rest of the post.
alter table public.posts add column if not exists contact text;

-- Picture of a TG swap post: the original LINE picture (QR code, notes) kept in a private bucket while the post's days
-- are still ahead; line-ingest removes it once every post using it is in the past. Only approved TG members can open it.
alter table public.posts add column if not exists pic text;
insert into storage.buckets (id, name, public) values ('tg-pics', 'tg-pics', false) on conflict (id) do nothing;
drop policy if exists tg_pics_read on storage.objects;
create policy tg_pics_read on storage.objects for select to authenticated
  using (bucket_id = 'tg-pics' and (select public.is_approved()) and (select public.my_airline()) = 'TG');
select 'ok' as done;
