@AGENTS.md
# IronQuest — Claude Code Project Instructions

## What this is
Gamified calisthenics + nutrition PWA. Full product spec lives in `docs/spec.md`.
**Read the relevant section of docs/spec.md before implementing any feature.** The spec is the source of truth for XP values, streak rules, data model, and screen layouts. If an implementation decision contradicts the spec, stop and ask.

## Stack
- Next.js (App Router, TypeScript, server components by default)
- Tailwind + shadcn/ui — use existing shadcn components before writing custom ones
- Supabase: Postgres + Auth + Storage. RLS on every table, scoped to auth.uid()
- Deployed on Vercel
- Claude API (claude-sonnet-4-6) for meal macro estimation — Phase 3 only

## Hard rules
1. **Migrations only via Supabase CLI.** Schema changes = new file in `supabase/migrations/`, never dashboard edits. Never modify an already-pushed migration; write a new one.
2. **RLS from the first migration.** Every table gets policies at creation time, not "later."
3. **Mobile-first.** Design at 390px width first. Desktop is an afterthought.
4. **Every logging flow must be completable in under 20 seconds.** If a feature adds taps to workout check-off or meal logging, flag it before building.
5. **One vertical slice per session.** Don't scaffold ahead of the current slice. No placeholder pages for future phases.
6. **XP/points mutations go through a single server-side function** (`xp_ledger` insert + derived updates). Never award XP from client code.
7. **Phase discipline:** we are in Phase 1 (core loop) unless told otherwise. Do not implement skill tree UI, points store, AI meal estimation, or check-in photos until their phase.

## Conventions
- Server actions for mutations; React Query for client cache where needed
- Zod schemas for all form/API input validation, colocated in `lib/validations/`
- Database types generated via `supabase gen types typescript` → `lib/database.types.ts` — regenerate after every migration
- Dates/times stored UTC, displayed in America/Mexico_City
- Units metric (kg, cm, km); kcal for energy
- Spanish/English food names both expected in food logging — don't assume English

## Current phase: 1 — Core loop
Slices in order:
1. Auth (Supabase email + Google) + onboarding (profile, TDEE calc, targets, split selection)
2. Full schema migration (all tables from spec §8, with RLS)
3. Routine builder + 3 seeded template splits
4. Workout check-off logging + XP/streak engine
5. Home screen / character sheet (level, XP bar, streak, today's quest, macro rings)
6. Manual food logging + My Foods library

## Testing / verification
- After each slice: `npm run build` must pass clean before considering it done
- Verify RLS by querying as a second test user
- Streak/XP logic: write unit tests for the edge cases (midnight boundary in Mexico City TZ, rest-day counting, streak reset preserving XP)
## Deferred: Google OAuth — enable provider in Supabase dashboard + Google Cloud credentials before production deploy
