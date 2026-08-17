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
- Claude API for meal macro estimation — **Phase 4 only** (confirm the current model at build time; the previously pinned `claude-sonnet-4-6` is dated)

## Hard rules
1. **Migrations only via Supabase CLI.** Schema changes = new file in `supabase/migrations/`, never dashboard edits. Never modify an already-pushed migration; write a new one.
2. **RLS from the first migration.** Every table gets policies at creation time, not "later."
3. **Mobile-first.** Design at 390px width first. Desktop is an afterthought.
4. **Every logging flow must be completable in under 20 seconds.** If a feature adds taps to workout check-off or meal logging, flag it before building.
5. **One vertical slice per session.** Don't scaffold ahead of the current slice. No placeholder pages for future phases.
6. **XP/points mutations go through a single server-side function** (`xp_ledger` insert + derived updates). Never award XP from client code.
7. **Phase discipline:** we are in **Phase 3 (disciplines + measurement)** as of 2026-07-28 (Phases 1 & 2 complete — see phase status below). Do not implement Phase 4 work (AI meal estimation, compensation feature, Open Food Facts/barcode, productization) until its phase.

## Conventions
- Server actions for mutations; React Query for client cache where needed
- Zod schemas for all form/API input validation, colocated in `lib/validations/`
- Database types generated via `supabase gen types typescript` → `lib/database.types.ts` — regenerate after every migration
- Dates/times stored UTC, displayed in America/Mexico_City
- Units metric (kg, cm, km); kcal for energy
- Spanish/English food names both expected in food logging — don't assume English

## Phase status
- **Phase 1 — Core loop: ✅ complete.** Auth + onboarding (TDEE/targets/split), full schema + RLS, routine builder + 3 template splits, workout check-off + XP/streak engine, home/character sheet, manual food logging + My Foods.
- **Phase 2 — Game layer: ✅ complete (verified 2026-07-28).** Skill-unlock + PR engine; skill tree UI (left→right per-branch progression, no pan/zoom) + stat radar + full-screen unlock celebration; points store (real-life rewards, atomic redeem) + cosmetics tab; layered avatar with man/woman character selection (onboarding step + profile setting, data-driven figure registry); five app-wide art-style themes with optional CSS-only background layers. Backlog B1/B2-base are **done**; B3 + B2-evolution now land in Phase 3.
- **Session 13 (2026-08-04) — fitness-core additions on top of Phase 2:** challenge-based skill unlocks (`skill_challenges`, `attempt_challenge`/`decline_challenge`; readiness offers returned by `complete_workout`; fast-track cascade at `CASCADE_XP_RATE` under the `skill_unlock_cascade` ledger action — absorbs B4) and per-set difficulty feedback + adaptive volume (`workout_sets.difficulty`, `prescription_adjustments`, `lib/fitness/adaptation.ts`; proposals are **never** auto-applied — partially absorbs B6). Unlocks remain evidence-based: no self-declaration path exists.
- **Session 14 (2026-08-16) — lifetime stats + real-world equivalences:** `exercises.movement_family` groups movements for lifetime totals; `/stats` shows per-movement counters, the converted headline (metres climbed, tonnes pressed, floors) and the bar to the next equivalence; crossings pay a small XP bounty (`equivalence_milestone` ledger action) through `evaluate_milestones`, recorded in `user_milestones` so they never re-fire. History that predates the feature is recorded at **0 XP** — counters are retroactive, awards are not. **Milestones are config**: author them in `lib/game/equivalences.ts`, then `npm run sync:milestones` mirrors the numbers into the `equivalence_milestones` catalog SQL reads (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; `-- --check` audits drift read-only, `-- --sql` prints the statement). Never add a milestone via a migration.
- **Current phase: 3 — Disciplines + measurement (reordered 2026-07-28).** Finish the *fitness* experience before introducing a second life-change; nutrition intelligence is a separate behaviour change and adoption is easier one at a time. Slices in order:
  1. **Disciplines / multiclassing** (B3 — calisthenics, gym/weights, running, cycling, yoga+mobility): per-discipline exercise library + skill paths, multiclass unlock at a level threshold, discipline-flavoured stat radar. Schema note: the `exercises` migration generalizes `branch` → `discipline + branch`.
  2. **Body evolution by training style** (B2-evolution) — depends on 1 defining the disciplines.
  3. **Weekly check-in flow** (weight + measurements + photos → `checkins`, Storage bucket + trend charts). Stays in near-term scope: it *measures the fitness goal*, it is not nutrition.
- **Phase 4 — Nutrition intelligence + productization (later):**
  1. AI meal macro estimation (Claude API — confirm/refresh the pinned model at build time)
  2. Meal compensation feature (strict/neutral, comp quests)
  3. Open Food Facts + barcode lookup
  4. Productization: push notifications, offline sync hardening, onboarding for strangers, landing page.
  **Manual food logging (Phase 1) stays as-is** — it is the working baseline these features layer onto.
- **Naming:** "**path**" means a goal-skill line in the skill tree (Planche Path, Front Lever Path — `skill_paths` / `skill_path_nodes`, Session 12). The cross-modality concept is a "**discipline**". Don't reuse "path" for it.

## Testing / verification
- After each slice: `npm run build` must pass clean before considering it done
- Verify RLS by querying as a second test user
- Streak/XP logic: write unit tests for the edge cases (midnight boundary in Mexico City TZ, rest-day counting, streak reset preserving XP)
## Deferred: Google OAuth — enable provider in Supabase dashboard + Google Cloud credentials before production deploy
