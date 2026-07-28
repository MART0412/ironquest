-- Part 3b: the five app-wide art styles, each with an optional CSS-only
-- background layer (metadata.background). Rows are UPDATED in place and matched
-- by their existing slug, so ownership (cosmetic_unlocks references the row id)
-- survives the retune — nobody loses a purchased theme.
--
-- Art direction is original: self-authored palettes and CSS gradient/pattern
-- backgrounds. No assets, characters, or trade dress from existing games.

-- 1) Modern dark — clean, low-chroma dark UI with a soft vignette.
update public.cosmetics set
  slug = 'theme-modern-dark',
  name = 'Modern Dark',
  cost_points = 500,
  metadata = '{"label":"Modern Dark",
    "background":"radial-gradient(120% 80% at 50% 0%, oklch(0.28 0.03 265) 0%, oklch(0.18 0.02 265) 55%, oklch(0.15 0.02 265) 100%)",
    "vars":{
      "--background":"oklch(0.16 0.02 265)","--foreground":"oklch(0.96 0.01 265)",
      "--card":"oklch(0.21 0.02 265)","--card-foreground":"oklch(0.96 0.01 265)",
      "--popover":"oklch(0.21 0.02 265)","--popover-foreground":"oklch(0.96 0.01 265)",
      "--primary":"oklch(0.70 0.15 250)","--primary-foreground":"oklch(0.16 0.02 265)",
      "--secondary":"oklch(0.26 0.02 265)","--secondary-foreground":"oklch(0.96 0.01 265)",
      "--muted":"oklch(0.25 0.02 265)","--muted-foreground":"oklch(0.72 0.02 265)",
      "--accent":"oklch(0.70 0.15 250)","--accent-foreground":"oklch(0.16 0.02 265)",
      "--border":"oklch(1 0 0 / 12%)","--input":"oklch(1 0 0 / 16%)",
      "--ring":"oklch(0.70 0.15 250)","--radius":"0.75rem"}}'
where slug = 'theme-neon-arcade';

-- 2) Classic 8-bit — hard edges, limited high-contrast palette, chunky checker.
update public.cosmetics set
  slug = 'theme-classic-8bit',
  name = 'Classic 8-Bit',
  cost_points = 600,
  metadata = '{"label":"Classic 8-Bit",
    "background":"repeating-conic-gradient(oklch(0.94 0 0) 0% 25%, oklch(0.90 0 0) 0% 50%)",
    "backgroundSize":"24px 24px",
    "vars":{
      "--background":"oklch(0.94 0 0)","--foreground":"oklch(0.12 0 0)",
      "--card":"oklch(1 0 0)","--card-foreground":"oklch(0.12 0 0)",
      "--popover":"oklch(1 0 0)","--popover-foreground":"oklch(0.12 0 0)",
      "--primary":"oklch(0.55 0.23 25)","--primary-foreground":"oklch(0.98 0 0)",
      "--secondary":"oklch(0.88 0 0)","--secondary-foreground":"oklch(0.12 0 0)",
      "--muted":"oklch(0.88 0 0)","--muted-foreground":"oklch(0.36 0 0)",
      "--accent":"oklch(0.58 0.20 250)","--accent-foreground":"oklch(0.98 0 0)",
      "--border":"oklch(0.12 0 0)","--input":"oklch(0.12 0 0)",
      "--ring":"oklch(0.55 0.23 25)","--radius":"0rem"}}'
where slug = 'theme-8-bit';

-- 3) Bright retro-console — saturated primaries, rounded shapes, sunset bands.
update public.cosmetics set
  slug = 'theme-retro-console',
  name = 'Bright Retro Console',
  cost_points = 600,
  metadata = '{"label":"Bright Retro Console",
    "background":"linear-gradient(180deg, oklch(0.95 0.06 70) 0%, oklch(0.93 0.08 40) 45%, oklch(0.94 0.05 330) 100%)",
    "vars":{
      "--background":"oklch(0.96 0.03 70)","--foreground":"oklch(0.25 0.05 40)",
      "--card":"oklch(0.99 0.02 80)","--card-foreground":"oklch(0.25 0.05 40)",
      "--popover":"oklch(0.99 0.02 80)","--popover-foreground":"oklch(0.25 0.05 40)",
      "--primary":"oklch(0.66 0.20 30)","--primary-foreground":"oklch(0.99 0.02 85)",
      "--secondary":"oklch(0.92 0.06 70)","--secondary-foreground":"oklch(0.25 0.05 40)",
      "--muted":"oklch(0.92 0.05 70)","--muted-foreground":"oklch(0.48 0.06 45)",
      "--accent":"oklch(0.70 0.17 340)","--accent-foreground":"oklch(0.99 0.02 85)",
      "--border":"oklch(0.82 0.06 55)","--input":"oklch(0.82 0.06 55)",
      "--ring":"oklch(0.66 0.20 30)","--radius":"1.75rem"}}'
where slug = 'theme-sunset-retro';

-- 4) Hand-drawn cartoon — paper ground, ink lines, crosshatch tooth.
update public.cosmetics set
  slug = 'theme-hand-drawn',
  name = 'Hand-Drawn Cartoon',
  cost_points = 600,
  metadata = '{"label":"Hand-Drawn Cartoon",
    "background":"repeating-linear-gradient(45deg, oklch(0.20 0.02 60 / 4%) 0px 1px, oklch(0 0 0 / 0%) 1px 9px)",
    "vars":{
      "--background":"oklch(0.97 0.02 90)","--foreground":"oklch(0.18 0.02 60)",
      "--card":"oklch(0.99 0.01 90)","--card-foreground":"oklch(0.18 0.02 60)",
      "--popover":"oklch(0.99 0.01 90)","--popover-foreground":"oklch(0.18 0.02 60)",
      "--primary":"oklch(0.26 0.03 60)","--primary-foreground":"oklch(0.97 0.02 90)",
      "--secondary":"oklch(0.92 0.02 90)","--secondary-foreground":"oklch(0.18 0.02 60)",
      "--muted":"oklch(0.92 0.02 90)","--muted-foreground":"oklch(0.43 0.02 60)",
      "--accent":"oklch(0.55 0.13 30)","--accent-foreground":"oklch(0.97 0.02 90)",
      "--border":"oklch(0.30 0.02 60)","--input":"oklch(0.30 0.02 60)",
      "--ring":"oklch(0.26 0.03 60)","--radius":"1.1rem"}}'
where slug = 'theme-inkwell';

-- 5) Modern pixel-art — detailed pixel feel: fine grid over a richer gradient.
insert into public.cosmetics (slug, name, type, cost_points, metadata, sort_order)
values (
  'theme-modern-pixel', 'Modern Pixel-Art', 'ui_theme', 700,
  '{"label":"Modern Pixel-Art",
    "background":"repeating-linear-gradient(0deg, oklch(0.98 0.01 250 / 8%) 0px 1px, oklch(0 0 0 / 0%) 1px 8px), repeating-linear-gradient(90deg, oklch(0.98 0.01 250 / 8%) 0px 1px, oklch(0 0 0 / 0%) 1px 8px), linear-gradient(160deg, oklch(0.30 0.07 275) 0%, oklch(0.22 0.05 265) 60%, oklch(0.24 0.06 200) 100%)",
    "vars":{
      "--background":"oklch(0.23 0.05 268)","--foreground":"oklch(0.95 0.02 250)",
      "--card":"oklch(0.28 0.05 268)","--card-foreground":"oklch(0.95 0.02 250)",
      "--popover":"oklch(0.28 0.05 268)","--popover-foreground":"oklch(0.95 0.02 250)",
      "--primary":"oklch(0.78 0.17 155)","--primary-foreground":"oklch(0.18 0.04 268)",
      "--secondary":"oklch(0.33 0.05 268)","--secondary-foreground":"oklch(0.95 0.02 250)",
      "--muted":"oklch(0.32 0.04 268)","--muted-foreground":"oklch(0.76 0.04 250)",
      "--accent":"oklch(0.72 0.16 40)","--accent-foreground":"oklch(0.18 0.04 268)",
      "--border":"oklch(0.78 0.17 155 / 28%)","--input":"oklch(1 0 0 / 16%)",
      "--ring":"oklch(0.78 0.17 155)","--radius":"0.25rem"}}',
  42
)
on conflict (slug) do nothing;

-- Keep the store ordering stable and intentional.
update public.cosmetics set sort_order = 40 where slug = 'theme-modern-dark';
update public.cosmetics set sort_order = 41 where slug = 'theme-classic-8bit';
update public.cosmetics set sort_order = 43 where slug = 'theme-hand-drawn';
update public.cosmetics set sort_order = 44 where slug = 'theme-retro-console';
