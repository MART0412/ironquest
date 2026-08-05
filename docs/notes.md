# Usage notes — friction log & ideas backlog

Anything annoying, missing, confusing, or surprisingly good goes in the friction log. Bigger feature ideas go in the backlog with a phase tag.
Priority: 🔴 breaks the habit · 🟡 annoying · 🟢 nice-to-have

---

## Friction log

### 2026-07-22
- 🟡 No profile/character page existed — added tiered avatar page (done)
- 🟢 XP progress bar to next level: confirmed present on home screen (spec §3.2) — no action

*(add entries as you use the app daily...)*

---

## Ideas backlog

### B1 — Unlockable UI themes / art styles 【Phase 2, Session 10】
Users unlock or buy full visual themes for the app with points, beyond basic profile themes:
- Modern gaming (clean dark, neon accents)
- Classic 8-bit (chunky pixels, limited palette)
- Modern pixel-art (detailed pixel style, fluid gradients)
- Hand-drawn cartoon (ink-line, painterly)
- Bright retro-console (saturated primaries, rounded shapes)

Implementation: themes = CSS variable sets + optional background layer, applied app-wide, sold as cosmetics catalog items through the Session 10 redemption path. Original art direction only — inspired-by aesthetics, never assets or characters from existing games.

### B2 — Character selection + body evolution 【Phase 2 (base) ✅ → Phase 3 (evolution)】
- Base: user picks a character (man/woman) at onboarding or in profile — **done** (Session 10 base figures, Session 11 onboarding step + data-driven figure registry).
- Evolution: the body visibly changes with training — muscular (strength), leaner/faster silhouette (cardio), flexible poses (mobility). Art-heavy (discipline × sex × tier illustrations). Follows B3 because the evolution direction depends on the chosen **discipline**. The layered SVG architecture is what makes this a swap later, not a rewrite.

### B3 — Disciplines (multiclassing) 【Phase 3 — the near-term fitness milestone】
At profile creation, users choose a training **discipline**: Calisthenics, Gym/Weights, Running, Cycling, Yoga/Mobility (extensible). Each discipline gets its own exercise library + skill paths (the calisthenics tree is the template), discipline-appropriate goals/challenges, and a discipline-flavoured stat radar + avatar evolution (B2).

Multiclass rule: additional disciplines unlock only at a level threshold in the current one (e.g., level 15 to add a second). Multiple goals allowed within unlocked disciplines.

Moved Phase 4 → Phase 3 (2026-07-28): finish the complete fitness experience before adding nutrition intelligence, which is a second, separate behaviour change.

Schema prep: the `exercises` migration generalizes `branch` → `discipline + branch`.

> **Naming:** a "**path**" is a goal-skill line inside a discipline (Planche Path — `skill_paths`, Session 12). A "**discipline**" is the modality. Don't reuse "path" for the modality.

### B4 — Fast-track challenge from a locked node 【Phase 2 — absorbed, Session 13】
Any locked node further right in a path can be challenged directly from its detail sheet, not just the frontier. Succeeding unlocks it **and** cascade-unlocks the skipped prior nodes in that path at a reduced XP rate (distinct ledger action for auditability), so someone who already owns a skill isn't forced to grind up to it. Shared nodes cascade along the target's own paths only. Implemented in Session 13 Part 2b.

### B6 — Beginner self-calibration in week one 【Phase 3 — partially absorbed, Session 13】
A first-week user shouldn't have to guess their starting volume. Rather than a separate calibration wizard, the per-set difficulty feedback + adaptation engine (Session 13 Part 3) does it implicitly: tap "easy" twice and the app proposes a bigger prescription; tap "hard" and it proposes holding or deloading. Remaining for later: seeding a smarter *initial* prescription per exercise (today the template splits set it).

---

## Phase mapping summary

| Idea | Where it lands |
|---|---|
| B1 Unlockable art-style themes | ✅ Session 11 (five themes + background layers) |
| B2-base Character man/woman selection | ✅ Sessions 10–11 (layered avatar + onboarding step) |
| B4 Fast-track challenge unlock | ✅ Session 13 Part 2b |
| B6 Beginner self-calibration | ◐ Session 13 Part 3 (via difficulty feedback); smarter initial prescription still open |
| B3 Disciplines + multiclassing | **Phase 3** — near-term fitness milestone |
| B2-evolution Body evolution by training style | Phase 3, after B3 defines disciplines |
| Nutrition intelligence (AI meals, barcode, compensation) | **Phase 4** — moved out of Phase 3 on 2026-07-28 |
| Weekly check-in (weight/measurements/photos) | **Phase 3** — measures the fitness goal, not nutrition |
