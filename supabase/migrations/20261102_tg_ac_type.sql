-- CoolCrew TG: aircraft type of a swap post (A350 / B787 ...) so members can hide types they are not qualified on.
-- Filled by the LINE bot when the picture shows it; null = unknown (still shown, labelled). Safe to re-run.
alter table public.posts add column if not exists ac_type text;
select 'ok' as done;
