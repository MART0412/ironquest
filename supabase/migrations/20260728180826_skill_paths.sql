-- Session 12: goal-skill PATHS (spec §3). Restructures the skill tree from
-- muscle-group branches into left→right progressions that each end in a
-- signature skill.
--
-- Non-destructive by design: `exercises` and `skill_unlocks` are untouched
-- (live routines and unlocks reference exercise ids). Paths are a new
-- many-to-many layer, so one exercise can feed several paths and a single
-- per-exercise unlock lights it in every path that contains it.
--
-- exercises.branch/tier are retained for compatibility but are no longer the
-- source of adjacency — skill_path_nodes.position is.

-- ---------------------------------------------------------------------------
-- 1. Tables. Public read-only library, like `exercises` / `cosmetics`.
-- ---------------------------------------------------------------------------
create table public.skill_paths (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  name                  text not null,
  signature_exercise_id uuid not null references public.exercises (id) on delete restrict,
  display_order         integer not null default 0,
  created_at            timestamptz not null default now()
);

comment on table public.skill_paths is 'Goal-skill progressions; signature_exercise_id is the capstone shown at the far right.';

alter table public.skill_paths enable row level security;
create policy "Skill paths are readable by everyone"
  on public.skill_paths for select using (true);

create table public.skill_path_nodes (
  path_id     uuid not null references public.skill_paths (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position    integer not null check (position > 0),
  primary key (path_id, exercise_id),          -- an exercise appears at most once per path
  unique (path_id, position)                   -- no duplicate positions within a path
);

create index skill_path_nodes_path_position_idx
  on public.skill_path_nodes (path_id, position);
create index skill_path_nodes_exercise_idx
  on public.skill_path_nodes (exercise_id);

comment on table public.skill_path_nodes is 'Ordered membership of exercises in paths. Many-to-many: a shared node (e.g. dead hang) belongs to several paths.';

alter table public.skill_path_nodes enable row level security;
create policy "Skill path nodes are readable by everyone"
  on public.skill_path_nodes for select using (true);

-- ---------------------------------------------------------------------------
-- 2. Twelve new exercises filling gaps the paths expose. branch/tier are
--    assigned for schema compatibility only (appended past each branch's max).
-- ---------------------------------------------------------------------------
insert into public.exercises (slug, name, branch, tier, unlock_criteria, demo_notes) values
  ('planche-lean',           'Planche Lean',            'push', 12,
   '{"kind":"hold","sets":3,"seconds":20,"description":"3×20s hold"}',
   'Push-up position, shoulders leaning well past the wrists, body straight.'),
  ('frog-stand',             'Frog Stand',              'push', 13,
   '{"kind":"hold","sets":3,"seconds":20,"description":"3×20s hold"}',
   'Knees resting on bent elbows, feet off the floor, weight over the hands.'),
  ('straight-bar-dip',       'Straight-Bar Dip',        'push', 14,
   '{"kind":"reps","sets":3,"reps":8,"description":"3×8"}',
   'Support above a straight bar, lower until the chest reaches it, press back up.'),
  ('german-hang',            'German Hang',             'pull', 11,
   '{"kind":"hold","sets":3,"seconds":30,"description":"3×30s hold"}',
   'Hang behind the bar, shoulders extended, arms straight — open the shoulders slowly.'),
  ('skin-the-cat',           'Skin the Cat',            'pull', 12,
   '{"kind":"reps","sets":3,"reps":5,"description":"3×5 controlled"}',
   'From a hang, tuck and rotate through to a german hang, then reverse under control.'),
  ('tuck-back-lever',        'Tuck Back Lever',         'pull', 13,
   '{"kind":"hold","sets":3,"seconds":15,"description":"3×15s hold"}',
   'Rotate to face the floor with knees tucked, arms straight, hips at bar height.'),
  ('straddle-back-lever',    'Straddle Back Lever',     'pull', 14,
   '{"kind":"hold","sets":3,"seconds":10,"description":"3×10s hold"}',
   'Legs straight and wide to shorten the lever; body horizontal, arms locked.'),
  ('back-lever',             'Back Lever',              'pull', 15,
   '{"kind":"hold","sets":3,"seconds":5,"description":"3×5s hold"}',
   'Legs together, body horizontal and facing the floor, arms straight.'),
  ('high-pull',              'High Pull',               'pull', 16,
   '{"kind":"reps","sets":3,"reps":5,"description":"3×5 explosive"}',
   'Explosive pull-up bringing the bar to sternum/waist height — builds muscle-up speed.'),
  ('single-leg-front-lever', 'Single-Leg Front Lever',  'core', 11,
   '{"kind":"hold","sets":3,"seconds":10,"description":"3×10s per side"}',
   'Advanced tuck with one leg extended; keep the hips level and back flat.'),
  ('tuck-l-sit',             'Tuck L-Sit',              'core', 12,
   '{"kind":"hold","sets":3,"seconds":20,"description":"3×20s hold"}',
   'Support on hands with knees tucked to the chest, shoulders depressed.'),
  ('v-sit',                  'V-Sit',                   'core', 13,
   '{"kind":"hold","sets":3,"seconds":10,"description":"3×10s hold"}',
   'From an L-sit, raise straight legs above hip level into a compressed V.');

-- Reword one demo note so the Pistol path reads consistently: the box makes the
-- balance EASIER (assistance), which is why it sits before the flat pistol.
update public.exercises
set demo_notes = 'Stand on a box so the non-working leg hangs free — easier balance than a flat pistol.'
where slug = 'elevated-pistol-squat';

-- ---------------------------------------------------------------------------
-- 3. The nine paths. signature_exercise_id = the capstone.
-- ---------------------------------------------------------------------------
insert into public.skill_paths (slug, name, signature_exercise_id, display_order)
select v.slug, v.name, e.id, v.display_order
from (values
  ('planche',          'Planche Path',          'full-planche',       1),
  ('front-lever',      'Front Lever Path',      'front-lever',        2),
  ('back-lever',       'Back Lever Path',       'back-lever',         3),
  ('muscle-up',        'Muscle-Up Path',        'muscle-up',          4),
  ('one-arm-pull-up',  'One-Arm Pull-Up Path',  'one-arm-pull-up',    5),
  ('handstand',        'Handstand Path',        'freestanding-hspu',  6),
  ('one-arm-push-up',  'One-Arm Push-Up Path',  'one-arm-push-up',    7),
  ('pistol-squat',     'Pistol Squat Path',     'pistol-squat',       8),
  ('l-sit',            'L-Sit Path',            'v-sit',              9)
) as v(slug, name, capstone_slug, display_order)
join public.exercises e on e.slug = v.capstone_slug;

-- ---------------------------------------------------------------------------
-- 4. Ordered path membership (65 rows). Shared nodes appear in several paths.
-- ---------------------------------------------------------------------------
insert into public.skill_path_nodes (path_id, exercise_id, position)
select p.id, e.id, v.position
from (values
  -- Planche Path (8)
  ('planche', 'pike-push-up', 1),
  ('planche', 'pseudo-planche-push-up', 2),
  ('planche', 'planche-lean', 3),
  ('planche', 'frog-stand', 4),
  ('planche', 'tuck-planche', 5),
  ('planche', 'advanced-tuck-planche', 6),
  ('planche', 'straddle-planche', 7),
  ('planche', 'full-planche', 8),
  -- Front Lever Path (10)
  ('front-lever', 'dead-hang', 1),
  ('front-lever', 'scapular-pull', 2),
  ('front-lever', 'hanging-knee-raise', 3),
  ('front-lever', 'toes-to-bar', 4),
  ('front-lever', 'dragon-flag', 5),
  ('front-lever', 'tuck-front-lever', 6),
  ('front-lever', 'advanced-tuck-front-lever', 7),
  ('front-lever', 'single-leg-front-lever', 8),
  ('front-lever', 'straddle-front-lever', 9),
  ('front-lever', 'front-lever', 10),
  -- Back Lever Path (6)
  ('back-lever', 'dead-hang', 1),
  ('back-lever', 'german-hang', 2),
  ('back-lever', 'skin-the-cat', 3),
  ('back-lever', 'tuck-back-lever', 4),
  ('back-lever', 'straddle-back-lever', 5),
  ('back-lever', 'back-lever', 6),
  -- Muscle-Up Path (7)
  ('muscle-up', 'dead-hang', 1),
  ('muscle-up', 'negative-pull-up', 2),
  ('muscle-up', 'pull-up', 3),
  ('muscle-up', 'chest-to-bar-pull-up', 4),
  ('muscle-up', 'high-pull', 5),
  ('muscle-up', 'straight-bar-dip', 6),
  ('muscle-up', 'muscle-up', 7),
  -- One-Arm Pull-Up Path (7)
  ('one-arm-pull-up', 'dead-hang', 1),
  ('one-arm-pull-up', 'negative-pull-up', 2),
  ('one-arm-pull-up', 'pull-up', 3),
  ('one-arm-pull-up', 'archer-pull-up', 4),
  ('one-arm-pull-up', 'one-arm-negative', 5),
  ('one-arm-pull-up', 'assisted-one-arm-pull-up', 6),
  ('one-arm-pull-up', 'one-arm-pull-up', 7),
  -- Handstand Path (8)
  ('handstand', 'pike-push-up', 1),
  ('handstand', 'elevated-pike-push-up', 2),
  ('handstand', 'wall-handstand-hold', 3),
  ('handstand', 'chest-to-wall-handstand', 4),
  ('handstand', 'freestanding-handstand', 5),
  ('handstand', 'handstand-walk', 6),
  ('handstand', 'wall-handstand-push-up', 7),
  ('handstand', 'freestanding-hspu', 8),
  -- One-Arm Push-Up Path (6)
  ('one-arm-push-up', 'wall-push-up', 1),
  ('one-arm-push-up', 'incline-push-up', 2),
  ('one-arm-push-up', 'push-up', 3),
  ('one-arm-push-up', 'diamond-push-up', 4),
  ('one-arm-push-up', 'archer-push-up', 5),
  ('one-arm-push-up', 'one-arm-push-up', 6),
  -- Pistol Squat Path (8)
  ('pistol-squat', 'squat', 1),
  ('pistol-squat', 'split-squat', 2),
  ('pistol-squat', 'bulgarian-split-squat', 3),
  ('pistol-squat', 'archer-squat', 4),
  ('pistol-squat', 'shrimp-squat', 5),
  ('pistol-squat', 'assisted-pistol-squat', 6),
  ('pistol-squat', 'elevated-pistol-squat', 7),
  ('pistol-squat', 'pistol-squat', 8),
  -- L-Sit Path (5)
  ('l-sit', 'plank', 1),
  ('l-sit', 'hollow-hold', 2),
  ('l-sit', 'tuck-l-sit', 3),
  ('l-sit', 'l-sit', 4),
  ('l-sit', 'v-sit', 5)
) as v(path_slug, exercise_slug, position)
join public.skill_paths p on p.slug = v.path_slug
join public.exercises e on e.slug = v.exercise_slug;

-- ---------------------------------------------------------------------------
-- 5. Fail the migration loudly if any slug above was mistyped (a bad join
--    would silently drop rows) or an invariant is violated.
-- ---------------------------------------------------------------------------
do $$
declare
  v_paths     integer;
  v_nodes     integer;
  v_orphans   integer;
  v_gaps      integer;
  v_capstones integer;
begin
  select count(*) into v_paths from public.skill_paths;
  if v_paths <> 9 then
    raise exception 'expected 9 skill paths, found %', v_paths;
  end if;

  select count(*) into v_nodes from public.skill_path_nodes;
  if v_nodes <> 65 then
    raise exception 'expected 65 path node rows, found % (check for a mistyped slug)', v_nodes;
  end if;

  -- Every library exercise with unlock criteria must belong to at least one path.
  select count(*) into v_orphans
  from public.exercises e
  where e.unlock_criteria is not null
    and e.user_id is null
    and not exists (select 1 from public.skill_path_nodes n where n.exercise_id = e.id);
  if v_orphans <> 0 then
    raise exception '% library exercise(s) are not in any path', v_orphans;
  end if;

  -- Each path must be a contiguous 1..N chain.
  select count(*) into v_gaps
  from (
    select path_id, count(*) as n, min(position) as lo, max(position) as hi
    from public.skill_path_nodes group by path_id
  ) t
  where t.lo <> 1 or t.hi <> t.n;
  if v_gaps <> 0 then
    raise exception '% path(s) have non-contiguous positions', v_gaps;
  end if;

  -- The signature skill must be the last node of its own path.
  select count(*) into v_capstones
  from public.skill_paths p
  join public.skill_path_nodes n
    on n.path_id = p.id and n.exercise_id = p.signature_exercise_id
  where n.position = (select max(n2.position) from public.skill_path_nodes n2 where n2.path_id = p.id);
  if v_capstones <> 9 then
    raise exception 'only % of 9 paths end on their signature exercise', v_capstones;
  end if;
end $$;
