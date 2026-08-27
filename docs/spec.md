# IronQuest — Product Specification v1.0
### Gamified Calisthenics & Nutrition Tracker (working title — rename at will)

**Owner:** Miguel Rivera
**Date:** July 2026
**Stack:** Next.js (App Router) · Tailwind · shadcn/ui · Supabase (Postgres + Auth + Storage) · Vercel · Claude API (meal estimation)
**Form factor:** Mobile-first PWA (installable, offline-capable logging)
**Architecture:** Multi-user from day one (Supabase RLS per user), single-tenant UX for now

---

## 1. Vision

A personal RPG where the character is you. Training, eating well, and showing up consistently earn XP and points. The character levels up, unlocks calisthenics skills on a visual skill tree, and points buy both in-game upgrades and real-life rewards you define yourself. Progress toward the physique goal (sub-10% body fat, visible abs) is measured through a weekly check-in ritual, not daily scale anxiety.

Design principle #1: **logging must take under 20 seconds** in the common case. Every feature is judged against this.

---

## 2. Core Game Loop

```
Do the thing (train / eat well / check in)
        → Log it (fast)
        → Earn XP + Points
        → Level up / unlock skills / buy rewards
        → See the character (you) get stronger
        → Come back tomorrow to protect the streak
```

### 2.1 XP Economy

| Action | XP | Points | Notes |
|---|---|---|---|
| Complete a scheduled workout | 100 | 10 | Checked-off routine or full-detail log |
| Bonus/unscheduled workout | 50 | 5 | Capped at 1/day to prevent overtraining farming |
| Hit daily protein target | 40 | 4 | Most important macro for the goal |
| Stay within calorie target | 40 | 4 | ±5% tolerance band |
| Log all meals for the day | 20 | 2 | Rewards the habit of logging itself |
| Weekly check-in completed | 150 | 15 | Weight + measurements + photos |
| New skill unlocked (skill tree) | 200 | 25 | E.g., first strict muscle-up |
| Personal record (reps/hold time) | 75 | 10 | Auto-detected from logs |
| 7-day streak milestone | 100 | 20 | Repeats every 7 days of streak |

**Leveling curve:** Level N requires `500 × N^1.4` cumulative XP. Fast early levels (dopamine in week 1), meaningful grind later. Level 10 ≈ ~6 weeks of consistent effort.

### 2.2 Streak Mechanic (Hardcore Mode — your choice)

- A "streak day" = at least one workout logged **or** a designated rest day taken on schedule + meals logged.
- Miss a day → **streak resets to 0.** No freezes, no protection items. You chose hardcore.
- **What survives a reset:** level, total XP, points balance, skill tree, rewards. The streak is the only thing that dies. One bad day costs the multiplier, not the character.
- **Streak multiplier:** XP earned ×1.0 base, +0.05 per streak week, capped at ×1.5 (10 weeks). This makes long streaks valuable without making a reset feel like account deletion.
- Rest days are **scheduled, not skipped**: you declare your training split (e.g., 5 on / 2 off) and rest days count toward the streak *if meals are logged*. Discipline includes recovery.

### 2.3 Points Store (dual economy)

**In-game (cosmetic/functional):**
- Character gear & visual upgrades (belts, calluses, aura tiers — cosmetic flex)
- Profile themes, title unlocks ("Bar Tyrant", "Iron Monk")
- Custom badge designs

**Real-life rewards (user-defined):**
- You create the catalog: e.g., *"Bottle of good whiskey — 500 pts"*, *"Omakase night — 800 pts"*, *"New gadget — 2,000 pts"*
- Redeeming marks it claimed and logs the date — an honesty system with a receipt trail.
- Suggested pricing guide shown at creation (roughly: 1 point ≈ 1 committed action, so a 500-pt reward ≈ ~6–8 weeks of consistency).

---

## 3. The Character & Skill Tree

The RPG layer is a **calisthenics skill tree** — because in bodyweight training, progression is literally unlocking harder movements. This is the app's signature feature.

### 3.1 Skill Branches (v1)

- **PUSH:** incline push-up → push-up → diamond → archer → pseudo-planche → one-arm push-up → planche progressions
- **PULL:** dead hang → negative pull-up → pull-up → chest-to-bar → archer pull-up → muscle-up → one-arm progressions
- **CORE:** plank → hollow hold → hanging knee raise → toes-to-bar → L-sit → dragon flag → front lever progressions
- **LEGS:** squat → split squat → Bulgarian → shrimp squat → pistol squat progression
- **STATIC/SKILL:** wall handstand → freestanding handstand → handstand push-up

Each node has: unlock criteria (e.g., "3×8 strict pull-ups"), demo notes, and XP bounty. Unlocking a node lights it up on the tree and levels the corresponding character stat (STR / PULL / CORE / LEGS / BALANCE — displayed as an RPG stat radar).

### 3.2 Character Sheet

- Avatar with visual gear from points store
- Level, XP bar, current streak + multiplier
- Stat radar (5 stats driven by skill tree progress)
- "Quest log" = this week's scheduled workouts
- Body composition summary (latest check-in vs. goal)

---

## 4. Workouts

### 4.1 Three logging modes (your pick: mix)

**Mode A — Routine check-off (default, <20 sec):**
- Pre-built routines from your declared split (e.g., "Push Day A: 4×8 push-ups, 3×10 dips, 3×30s pseudo-planche lean")
- One tap per exercise to check off as prescribed; tap-and-hold to adjust reps if you did more/less
- "Complete workout" button → XP awarded, PRs auto-detected

**Mode B — Full detail:**
- Exercise picker (calisthenics library + custom), sets × reps or hold time, RPE optional
- Used when deviating from routine or testing skill unlocks

**Mode C — Duration sessions (`/activity`):**
- For anything measured in minutes rather than reps: runs and rides for the endurance disciplines, plus quick bonus activities (jog, jump rope, brisk walk…) available to every user whatever they train.
- Pick a preset, confirm the duration, optionally add distance and a note. XP = duration × MET intensity, capped per day so it can't be farmed; a session of 10 minutes or more counts as a streak day on the same rules as a workout.
- MET values live in `lib/fitness/activities.ts` and are shared with the Phase 4 compensation feature.
- **Manual entry only.** GPS tracking and wearable/Strava import are a future integration.

### 4.2 Routine builder

- Create routines from the exercise library, assign to weekdays (defines the split and rest days)
- v1 ships with 3 template splits: **3-day full body**, **4-day upper/lower**, **5-day push/pull/legs/skill/core**
- Progression suggestions: when you hit prescribed reps 2 sessions in a row, app suggests the next progression from the skill tree

---

## 5. Nutrition

### 5.1 Targets

- Onboarding calculates TDEE (Mifflin-St Jeor + activity factor), sets a moderate deficit for the cut phase (~15–20%) and a protein target (~2g/kg)
- Targets are editable and phase-aware: **Cut / Maintain / Build** presets, switchable anytime (sub-10% BF requires a cut phase; the app should support switching to maintenance/build after, not assume permanent deficit)

### 5.2 Logging (AI quick-log + database)

**AI quick-log (primary path):**
- Type or dictate: *"2 tacos de guisado de chicharrón y un agua de jamaica"* — or snap a photo
- Claude API estimates calories + macros, shows the estimate with a confidence note, one tap to accept or adjust
- Learns your staples: accepted entries get saved to **My Foods** for instant re-logging

**Database search (precision path):**
- Open Food Facts API (free, good MX/US coverage, barcode scanning via PWA camera) as v1 database
- Portion controls, recent/frequent lists

**My Foods library:** every accepted item is one tap to re-log. After 2–3 weeks, 80% of logging should be from this list — that's how friction dies.

### 5.3 The Compensation Feature (per-entry toggle: Strict / Neutral)

When you log an indulgence (flagged automatically when an item blows a meal past target, or manually with a 🍦 flag):

**Neutral mode:** an info card — *"McDonald's cone ≈ 200 kcal ≈ 3 km run, 25 min of burpees, or 40 min brisk walk."* Pure equivalence, no obligation, no effect on XP.

**Strict mode:** the card becomes an optional **side quest** — *"Redemption Run: 3 km within 48h → +50 XP and the entry is marked 'balanced'."* Completing it feels like a win; ignoring it costs nothing beyond the calories already counted in your daily total.

Design note: even strict mode is framed as *earning bonus XP*, never as punishment or debt. The calorie math is already handled by the daily budget — this feature is a motivational overlay, not double-counting. Equivalence table uses MET values scaled to your body weight.

---

## 6. Weekly Check-In Ritual (Sundays, ~5 min)

The single source of truth for the physique goal:

1. **Weight** (manual entry; smart-scale value if you have one)
2. **Measurements:** waist (navel), chest, arms, thighs
3. **Body fat estimate:** Navy formula from waist/neck/height, or smart-scale %, shown as a *trend* with an explicit "estimates are noisy, watch the 4-week slope" note
4. **Progress photos:** front/side/back → Supabase Storage (private bucket), side-by-side comparison viewer and timelapse strip
5. **Weekly review card:** streak, workouts done vs. planned, avg protein/calorie adherence, XP earned → 150 XP bounty on completion

Trend charts use 7-day rolling averages. Goal line drawn at target BF% with projected ETA based on current slope (clearly labeled as an estimate).

---

## 7. Screens (v1)

1. **Home / Character Sheet** — avatar, level, streak, today's quest (workout + macro rings), quick-log buttons
2. **Workout** — today's routine check-off, switch to detail mode, routine builder
3. **Skill Tree** — the visual centerpiece; pan/zoom tree with lit/locked nodes
4. **Nutrition** — macro rings, meal timeline, AI quick-log input (text/voice/photo), My Foods
5. **Progress** — weight/BF/measurement charts, photo comparison, weekly check-in flow
6. **Store** — in-game gear tab + real-life rewards tab (create/redeem)
7. **Lifetime** (`/stats`) — lifetime totals per movement (reps, hold-seconds, workouts) aggregated from `workout_sets`, each translated into a real-world equivalence with a progress bar to the next one ("312/600 pull-ups to summit the Eiffel Tower"). Crossing a threshold pays a small XP bounty and plays in the same ceremony slot as a skill unlock. Thresholds, conversions and copy are config in `lib/game/equivalences.ts`; adding one is a config edit plus `npm run sync:milestones`, never a migration.
8. **Disciplines** (onboarding step + `/profile` card) — the five ways to train (Calisthenics, Gym & Weights, Running, Cycling, Yoga & Mobility). You choose one at onboarding; a second unlocks at level 15 (`MULTICLASS_MIN_LEVEL`). Locked ones stay on screen, greyed with "Unlocks at level 15" — the aspiration is meant to be visible. Everything that reads the exercise library (skill tree, today's quest, routine builder) is scoped to what you have activated.
9. **Settings** — targets, phase (cut/maintain/build), split schedule, strict/neutral default, units (kg/metric default)

---

## 8. Data Model (Supabase)

```
profiles        (id, display_name, height_cm, dob, sex, activity_factor,
                 phase, cal_target, protein_g, carbs_g, fat_g, split_config jsonb)
exercises       (id, name, branch, tier, unlock_criteria jsonb, is_custom, user_id?)
routines        (id, user_id, name, day_of_week[])
routine_items   (routine_id, exercise_id, sets, reps_or_seconds, order)
workouts        (id, user_id, date, routine_id?, status, xp_awarded)
workout_sets    (workout_id, exercise_id, set_no, reps, seconds, rpe)
skill_unlocks   (user_id, exercise_id, unlocked_at, evidence_workout_id)
foods           (id, user_id?, name, kcal, protein, carbs, fat, serving, source)
meal_logs       (id, user_id, ts, food_id?, ai_raw jsonb, kcal, p, c, f,
                 indulgence bool, comp_mode enum, comp_quest_status)
checkins        (id, user_id, date, weight_kg, waist, neck, chest, arm, thigh,
                 bf_estimate, photo_paths[])
xp_ledger       (id, user_id, ts, action, xp, points, ref_id)
streaks         (user_id, current_start, current_len, best_len)
rewards         (id, user_id, title, cost_points, type enum(in_game|real_life),
                 redeemed_at?)
```

RLS: every table scoped to `auth.uid()`. Clean multi-tenant foundation for a future product — add an `orgs`/`friends` layer later without schema surgery.

---

## 9. PWA Requirements

- Installable (manifest + service worker), app icon, splash
- **Offline-first logging:** workout check-offs and meal logs queue in IndexedDB, sync on reconnect (gyms and kitchens have bad signal)
- Camera access for food photos, barcode scan, progress photos
- Push notifications (v1.1): workout reminder at your usual hour, streak-at-risk warning at 8 PM if nothing logged

---

## 10. Build Phases

**Phase 1 — Core loop (2–3 weekends):**
Auth, profile/targets onboarding, routine builder + check-off logging, XP/level/streak engine, home screen character sheet, manual food logging with My Foods, macro rings. *Usable and motivating with just this.*

**Phase 2 — The game (2 weekends):**
Skill tree UI + unlock detection, points store (both tabs), streak multiplier, PR detection, avatar visuals.

**Phase 3 — Disciplines + measurement (2–3 weekends):**
Multi-discipline training (Calisthenics / Gym-Weights / Running / Cycling / Yoga-Mobility): per-discipline exercise library and skill paths, multiclassing gated on a level threshold in the current discipline, discipline-flavoured stat radar, body evolution by training style. Plus the weekly check-in flow with photos and trend charts.

**Phase 4 — Nutrition intelligence + productize:**
Claude API meal estimation (text + photo), compensation feature with dual mode, Open Food Facts + barcode. Then push notifications, offline sync hardening, onboarding flow for strangers, landing page.

*Ordering rationale (reordered 2026-07-28):* finish the complete **fitness** experience before introducing a second life-change. Training and eating are two separate behaviour changes; shipping them in sequence means each is adopted on its own. The **weekly check-in stays in Phase 3** because it measures the fitness goal — it is not nutrition. **Manual food logging (Phase 1) remains as-is** and is the baseline Phase 4 layers onto.

---

## 11. Open Decisions (for build kickoff)

1. Name & visual identity — pixel-art RPG aesthetic vs. clean modern with game elements?
2. Avatar art: static tiers of illustrations (cheap, ship fast) vs. layered/animated (nice, slow)?
3. Voice input for meal logging in v1 or defer to v1.1?
4. Training split to seed as *your* default (suggest 4-day upper/lower for strength + recoverability during a cut)?

---

*One honest note baked into the design: the app treats the compensation feature and hardcore streaks as motivation tools, not moral judgments. If either ever starts feeling like it's working against you instead of for you, both have settings toggles — the goal is sub-10% BF and lasting discipline, not anxiety with a UI.*
