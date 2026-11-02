-- CoolCrew TG: aircraft type of a swap post (A350 / B787 ...) so members can hide types they are not qualified on.
-- Filled by the LINE bot when the picture shows it; null = unknown (still shown, labelled). Safe to re-run.
alter table public.posts add column if not exists ac_type text;
-- contact: LINE link of the poster, from the LINE ID or the LINE QR code on the picture (the TG group asks members
-- to put their LINE ID on swap pictures); shown only to approved TG members, like the rest of the post.
alter table public.posts add column if not exists contact text;
select 'ok' as done;
