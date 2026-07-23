-- B1: app-wide art-style themes as a new cosmetic type. Distinct from the
-- profile-accent 'theme'; an equipped 'ui_theme' reskins the whole app via a
-- CSS design-token override set in metadata.vars (applied at the root layout).
-- Reuses purchase_cosmetic / cosmetic_unlocks / cosmetic_equipped unchanged.

alter table public.cosmetics drop constraint cosmetics_type_check;
alter table public.cosmetics add constraint cosmetics_type_check
  check (type in ('title', 'theme', 'gear', 'ui_theme'));

-- Seed 4 themes (original palettes; impactful tokens only). Values mirror the
-- app/globals.css :root token names so descendants resolve to these overrides.
insert into public.cosmetics (slug, name, type, cost_points, metadata, sort_order) values
  ('theme-neon-arcade', 'Neon Arcade', 'ui_theme', 800,
   '{"label":"Neon Arcade","vars":{
      "--background":"oklch(0.17 0.03 275)","--foreground":"oklch(0.96 0.01 275)",
      "--card":"oklch(0.22 0.03 275)","--card-foreground":"oklch(0.96 0.01 275)",
      "--popover":"oklch(0.22 0.03 275)","--popover-foreground":"oklch(0.96 0.01 275)",
      "--primary":"oklch(0.72 0.20 330)","--primary-foreground":"oklch(0.17 0.03 275)",
      "--secondary":"oklch(0.28 0.03 275)","--secondary-foreground":"oklch(0.96 0.01 275)",
      "--muted":"oklch(0.27 0.02 275)","--muted-foreground":"oklch(0.74 0.03 300)",
      "--accent":"oklch(0.78 0.16 190)","--accent-foreground":"oklch(0.17 0.03 275)",
      "--border":"oklch(0.72 0.20 330 / 35%)","--input":"oklch(1 0 0 / 15%)",
      "--ring":"oklch(0.72 0.20 330)","--radius":"0.4rem"}}', 40),

  ('theme-8-bit', '8-Bit', 'ui_theme', 600,
   '{"label":"8-Bit","vars":{
      "--background":"oklch(0.97 0 0)","--foreground":"oklch(0.14 0 0)",
      "--card":"oklch(1 0 0)","--card-foreground":"oklch(0.14 0 0)",
      "--popover":"oklch(1 0 0)","--popover-foreground":"oklch(0.14 0 0)",
      "--primary":"oklch(0.55 0.23 25)","--primary-foreground":"oklch(0.98 0 0)",
      "--secondary":"oklch(0.9 0 0)","--secondary-foreground":"oklch(0.14 0 0)",
      "--muted":"oklch(0.9 0 0)","--muted-foreground":"oklch(0.38 0 0)",
      "--accent":"oklch(0.58 0.2 250)","--accent-foreground":"oklch(0.98 0 0)",
      "--border":"oklch(0.14 0 0)","--input":"oklch(0.14 0 0)",
      "--ring":"oklch(0.55 0.23 25)","--radius":"0rem"}}', 41),

  ('theme-sunset-retro', 'Sunset Retro', 'ui_theme', 600,
   '{"label":"Sunset Retro","vars":{
      "--background":"oklch(0.97 0.03 70)","--foreground":"oklch(0.26 0.05 40)",
      "--card":"oklch(0.99 0.02 80)","--card-foreground":"oklch(0.26 0.05 40)",
      "--popover":"oklch(0.99 0.02 80)","--popover-foreground":"oklch(0.26 0.05 40)",
      "--primary":"oklch(0.68 0.19 35)","--primary-foreground":"oklch(0.99 0.02 85)",
      "--secondary":"oklch(0.92 0.05 70)","--secondary-foreground":"oklch(0.26 0.05 40)",
      "--muted":"oklch(0.92 0.04 70)","--muted-foreground":"oklch(0.5 0.06 45)",
      "--accent":"oklch(0.72 0.16 340)","--accent-foreground":"oklch(0.99 0.02 85)",
      "--border":"oklch(0.84 0.05 60)","--input":"oklch(0.84 0.05 60)",
      "--ring":"oklch(0.68 0.19 35)","--radius":"1.5rem"}}', 42),

  ('theme-inkwell', 'Inkwell', 'ui_theme', 500,
   '{"label":"Inkwell","vars":{
      "--background":"oklch(0.97 0.01 90)","--foreground":"oklch(0.2 0.02 60)",
      "--card":"oklch(0.99 0.01 90)","--card-foreground":"oklch(0.2 0.02 60)",
      "--popover":"oklch(0.99 0.01 90)","--popover-foreground":"oklch(0.2 0.02 60)",
      "--primary":"oklch(0.28 0.03 60)","--primary-foreground":"oklch(0.97 0.01 90)",
      "--secondary":"oklch(0.92 0.01 90)","--secondary-foreground":"oklch(0.2 0.02 60)",
      "--muted":"oklch(0.92 0.01 90)","--muted-foreground":"oklch(0.45 0.02 60)",
      "--accent":"oklch(0.55 0.12 30)","--accent-foreground":"oklch(0.97 0.01 90)",
      "--border":"oklch(0.35 0.02 60)","--input":"oklch(0.35 0.02 60)",
      "--ring":"oklch(0.28 0.03 60)","--radius":"0.9rem"}}', 43);
