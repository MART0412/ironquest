-- B2-base: avatar character presentation (man/woman), separate from profiles.sex
-- (which drives the BMR calc). Nullable — a null value derives from sex at
-- render time (resolveCharacter in lib/game/avatar.ts), so no backfill is needed
-- and changing the avatar never touches nutrition targets. Owner-RLS on profiles
-- (Slice 1) already governs updates.

alter table public.profiles
  add column avatar_character text check (avatar_character in ('man', 'woman'));
