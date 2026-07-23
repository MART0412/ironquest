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

### B2 — Character selection + body evolution 【Phase 2 (base) → Phase 4 (evolution)】
- Base: user picks a character (man/woman) at onboarding or in profile — lands in Session 10 as two base-figure sets in the layered avatar.
- Evolution: the body visibly changes with training — muscular (strength), leaner/faster silhouette (cardio), flexible poses (mobility). Art-heavy (discipline × sex × tier illustrations). Deferred to Phase 4 because the evolution direction depends on the chosen path (B3). Session 10's layered SVG architecture is what makes this a swap later, not a rewrite.

### B3 — Training paths / disciplines (multiclassing) 【Phase 4 — the productization feature】
At profile creation, users choose a training path: Calisthenics, Gym/Weights, Running, Cycling, Yoga/Mobility (extensible). Each path gets its own exercise library + skill tree (the calisthenics tree is the template), path-appropriate goals/challenges, and a path-flavored stat radar + avatar evolution (B2).

Multiclass rule: additional paths unlock only at a level threshold in the current path (e.g., level 15 to add a second discipline). Multiple goals allowed within unlocked paths.

Why Phase 4: 5× the content design, schema extension (paths, per-path progress), multiplies B2's art needs. Prove the game is fun with one path first — daily personal use is the validation.

Schema prep that costs nothing now: any Phase 2/3 migration touching `exercises` should remember `branch` will generalize to `path + branch` in Phase 4.

---

## Phase mapping summary

| Idea | Where it lands |
|---|---|
| Character man/woman selection | Session 10 (two base figures, layered avatar) |
| Unlockable art-style themes | Session 10 catalog (or Session 11 if 10 runs long) |
| Body evolution by training style | Phase 4, after B3 defines paths |
| Training paths + multiclassing | Phase 4 — productization milestone |
