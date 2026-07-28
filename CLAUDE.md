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
7. **Phase discipline:** we are in **Phase 3 (intelligence)** as of 2026-07-22 (Phases 1 & 2 complete — see phase status below). Do not implement Phase 4 work (disciplines / multiclassing, body evolution) until its phase.

## Conventions
- Server actions for mutations; React Query for client cache where needed
- Zod schemas for all form/API input validation, colocated in `lib/validations/`
- Database types generated via `supabase gen types typescript` → `lib/database.types.ts` — regenerate after every migration
- Dates/times stored UTC, displayed in America/Mexico_City
- Units metric (kg, cm, km); kcal for energy
- Spanish/English food names both expected in food logging — don't assume English

## Phase status
- **Phase 1 — Core loop: ✅ complete.** Auth + onboarding (TDEE/targets/split), full schema + RLS, routine builder + 3 template splits, workout check-off + XP/streak engine, home/character sheet, manual food logging + My Foods.
- **Phase 2 — Game layer: ✅ complete (verified 2026-07-28).** Skill-unlock + PR engine; skill tree UI (left→right per-branch progression, no pan/zoom) + stat radar + full-screen unlock celebration; points store (real-life rewards, atomic redeem) + cosmetics tab; layered avatar with man/woman character selection (onboarding step + profile setting, data-driven figure registry); five app-wide art-style themes with optional CSS-only background layers. Backlog B1/B2-base are **done** — what remains is Phase 4 (B2-evolution, B3).
- **Current phase: 3 — Intelligence.** Slices in order:
  1. AI meal macro estimation (Claude API — CLAUDE.md pins claude-sonnet-4-6; confirm/refresh the model at build time)
  2. Meal compensation feature (strict/neutral, comp quests)
  3. Open Food Facts + barcode lookup
  4. Weekly check-in flow (weight + measurements + photos → `checkins`, Storage bucket)
- **Phase 4 — Productization (later):** **disciplines** / multiclassing (B3 — calisthenics, gym/weights, running, cycling, yoga), body evolution by training style (B2-evolution). Schema note: a future `exercises` migration generalizes `branch` → `discipline + branch`.
  - **Naming:** "**path**" now means a goal-skill line in the skill tree (Planche Path, Front Lever Path — `skill_paths` / `skill_path_nodes`, Session 12). Phase 4's cross-modality concept is a "**discipline**". Don't reuse "path" for it.

## Testing / verification
- After each slice: `npm run build` must pass clean before considering it done
- Verify RLS by querying as a second test user
- Streak/XP logic: write unit tests for the edge cases (midnight boundary in Mexico City TZ, rest-day counting, streak reset preserving XP)
## Deferred: Google OAuth — enable provider in Supabase dashboard + Google Cloud credentials before production deploy
