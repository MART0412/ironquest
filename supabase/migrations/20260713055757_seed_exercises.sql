-- Slice 2: seed the global calisthenics exercise library (spec §3.1).
-- Global rows: user_id null, is_custom false (defaults). tier = position within
-- branch. unlock_criteria is self-describing jsonb for the Phase-2 unlock engine:
--   {"kind":"reps","sets":n,"reps":n,"description":"..."}
--   {"kind":"hold","sets":n,"seconds":n,"description":"..."}
-- Shipped as a migration (not seed.sql) so it reaches the remote project.

insert into public.exercises (slug, name, branch, tier, unlock_criteria, demo_notes) values

-- PUSH (11): incline → push-up → diamond → archer → pseudo-planche → one-arm → planche progressions
('wall-push-up',            'Wall Push-Up',                 'push', 1,  '{"kind":"reps","sets":3,"reps":15,"description":"3×15"}',                    'Hands on wall at chest height, body in one straight line.'),
('incline-push-up',         'Incline Push-Up',              'push', 2,  '{"kind":"reps","sets":3,"reps":12,"description":"3×12"}',                    'Hands on bench or table edge; lower chest to the edge.'),
('push-up',                 'Push-Up',                      'push', 3,  '{"kind":"reps","sets":3,"reps":10,"description":"3×10 strict"}',             'Full range, rigid body, elbows about 45° from torso.'),
('diamond-push-up',         'Diamond Push-Up',              'push', 4,  '{"kind":"reps","sets":3,"reps":10,"description":"3×10"}',                    'Thumbs and index fingers form a diamond under the sternum.'),
('archer-push-up',          'Archer Push-Up',               'push', 5,  '{"kind":"reps","sets":3,"reps":6,"description":"3×6 per side"}',             'Wide hands; shift over one arm, the other stays straight.'),
('pseudo-planche-push-up',  'Pseudo-Planche Push-Up',       'push', 6,  '{"kind":"reps","sets":3,"reps":8,"description":"3×8"}',                      'Hands at waist level, fingers back, shoulders lean past wrists.'),
('one-arm-push-up',         'One-Arm Push-Up',              'push', 7,  '{"kind":"reps","sets":3,"reps":5,"description":"3×5 per side"}',             'Feet wide, hips square, working shoulder packed.'),
('tuck-planche',            'Tuck Planche',                 'push', 8,  '{"kind":"hold","sets":3,"seconds":15,"description":"3×15s hold"}',           'Knees tucked to chest, arms straight, lean until feet float.'),
('advanced-tuck-planche',   'Advanced Tuck Planche',        'push', 9,  '{"kind":"hold","sets":3,"seconds":12,"description":"3×12s hold"}',           'Back flat, knees pulled away from the chest.'),
('straddle-planche',        'Straddle Planche',             'push', 10, '{"kind":"hold","sets":3,"seconds":8,"description":"3×8s hold"}',             'Legs straight and wide; squeeze glutes, lock elbows.'),
('full-planche',            'Full Planche',                 'push', 11, '{"kind":"hold","sets":3,"seconds":5,"description":"3×5s hold"}',             'Legs together, body parallel to the floor.'),

-- PULL (10): dead hang → negative → pull-up → chest-to-bar → archer → muscle-up → one-arm progressions
('dead-hang',               'Dead Hang',                    'pull', 1,  '{"kind":"hold","sets":3,"seconds":30,"description":"3×30s hang"}',           'Passive hang from the bar, shoulders relaxed, grip firm.'),
('scapular-pull',           'Scapular Pull',                'pull', 2,  '{"kind":"reps","sets":3,"reps":10,"description":"3×10"}',                    'From a dead hang, depress the shoulder blades with straight arms.'),
('negative-pull-up',        'Negative Pull-Up',             'pull', 3,  '{"kind":"reps","sets":3,"reps":5,"description":"3×5 with 5s descent"}',      'Jump to the top position, lower under control for 5 seconds.'),
('pull-up',                 'Pull-Up',                      'pull', 4,  '{"kind":"reps","sets":3,"reps":8,"description":"3×8 strict"}',               'Dead-hang start, chin clearly over the bar, no kipping.'),
('chest-to-bar-pull-up',    'Chest-to-Bar Pull-Up',         'pull', 5,  '{"kind":"reps","sets":3,"reps":6,"description":"3×6"}',                      'Pull explosively until the chest touches the bar.'),
('archer-pull-up',          'Archer Pull-Up',               'pull', 6,  '{"kind":"reps","sets":3,"reps":5,"description":"3×5 per side"}',             'Pull toward one hand while the other arm stays straight.'),
('muscle-up',               'Muscle-Up',                    'pull', 7,  '{"kind":"reps","sets":3,"reps":3,"description":"3×3 strict"}',               'False grip, explosive pull, smooth transition over the bar.'),
('one-arm-negative',        'One-Arm Negative',             'pull', 8,  '{"kind":"reps","sets":3,"reps":3,"description":"3×3 per side, 5s descent"}', 'From the top with one arm, lower as slowly as possible.'),
('assisted-one-arm-pull-up','Assisted One-Arm Pull-Up',     'pull', 9,  '{"kind":"reps","sets":3,"reps":3,"description":"3×3 per side"}',             'One hand on a towel or band for partial assistance.'),
('one-arm-pull-up',         'One-Arm Pull-Up',              'pull', 10, '{"kind":"reps","sets":1,"reps":1,"description":"1 clean rep per side"}',     'Full dead hang to chin over bar with one arm.'),

-- CORE (10): plank → hollow → knee raise → toes-to-bar → L-sit → dragon flag → front lever progressions
('plank',                   'Plank',                        'core', 1,  '{"kind":"hold","sets":3,"seconds":45,"description":"3×45s"}',                'Elbows under shoulders, glutes tight, no sagging hips.'),
('hollow-hold',             'Hollow Hold',                  'core', 2,  '{"kind":"hold","sets":3,"seconds":30,"description":"3×30s"}',                'Lower back pressed into the floor, arms and legs extended.'),
('hanging-knee-raise',      'Hanging Knee Raise',           'core', 3,  '{"kind":"reps","sets":3,"reps":10,"description":"3×10"}',                    'From a hang, raise knees to hip height without swinging.'),
('toes-to-bar',             'Toes-to-Bar',                  'core', 4,  '{"kind":"reps","sets":3,"reps":8,"description":"3×8"}',                      'Straight legs, toes touch the bar, controlled descent.'),
('l-sit',                   'L-Sit',                        'core', 5,  '{"kind":"hold","sets":3,"seconds":15,"description":"3×15s"}',                'On floor or parallettes; legs straight and parallel to the ground.'),
('dragon-flag',             'Dragon Flag',                  'core', 6,  '{"kind":"reps","sets":3,"reps":5,"description":"3×5"}',                      'Shoulders anchored; lower a straight body slowly, hips never break.'),
('tuck-front-lever',        'Tuck Front Lever',             'core', 7,  '{"kind":"hold","sets":3,"seconds":15,"description":"3×15s hold"}',           'Hang, tuck knees, pull hips to bar height, body horizontal.'),
('advanced-tuck-front-lever','Advanced Tuck Front Lever',   'core', 8,  '{"kind":"hold","sets":3,"seconds":12,"description":"3×12s hold"}',           'Open the hip angle, back flat and horizontal.'),
('straddle-front-lever',    'Straddle Front Lever',         'core', 9,  '{"kind":"hold","sets":3,"seconds":8,"description":"3×8s hold"}',             'Legs straight and wide, body a rigid horizontal line.'),
('front-lever',             'Front Lever',                  'core', 10, '{"kind":"hold","sets":3,"seconds":5,"description":"3×5s hold"}',             'Legs together, body horizontal, arms straight.'),

-- LEGS (8): squat → split squat → Bulgarian → shrimp → pistol progression
('squat',                   'Bodyweight Squat',             'legs', 1,  '{"kind":"reps","sets":3,"reps":20,"description":"3×20"}',                    'Below parallel, heels down, chest up.'),
('split-squat',             'Split Squat',                  'legs', 2,  '{"kind":"reps","sets":3,"reps":12,"description":"3×12 per side"}',           'Long stance; rear knee kisses the floor.'),
('bulgarian-split-squat',   'Bulgarian Split Squat',        'legs', 3,  '{"kind":"reps","sets":3,"reps":10,"description":"3×10 per side"}',           'Rear foot elevated on a bench; torso tall.'),
('archer-squat',            'Archer Squat',                 'legs', 4,  '{"kind":"reps","sets":3,"reps":8,"description":"3×8 per side"}',             'Wide stance, sit fully over one leg, other leg straight.'),
('shrimp-squat',            'Shrimp Squat',                 'legs', 5,  '{"kind":"reps","sets":3,"reps":6,"description":"3×6 per side"}',             'Hold rear foot behind you; rear knee touches the floor.'),
('assisted-pistol-squat',   'Assisted Pistol Squat',        'legs', 6,  '{"kind":"reps","sets":3,"reps":6,"description":"3×6 per side"}',             'Hold a pole or doorframe lightly; full-depth single-leg squat.'),
('pistol-squat',            'Pistol Squat',                 'legs', 7,  '{"kind":"reps","sets":3,"reps":5,"description":"3×5 per side"}',             'Free leg straight in front, full depth, no assistance.'),
('elevated-pistol-squat',   'Elevated Pistol Squat',        'legs', 8,  '{"kind":"reps","sets":3,"reps":5,"description":"3×5 per side"}',             'From a box so the free leg can drop below the standing foot.'),

-- STATIC/SKILL (8): wall handstand → freestanding handstand → handstand push-up
('pike-push-up',            'Pike Push-Up',                 'static', 1, '{"kind":"reps","sets":3,"reps":10,"description":"3×10"}',                   'Hips high in an A-shape; head travels toward the floor between the hands.'),
('elevated-pike-push-up',   'Elevated Pike Push-Up',        'static', 2, '{"kind":"reps","sets":3,"reps":8,"description":"3×8"}',                     'Feet on a box, hips stacked over shoulders.'),
('wall-handstand-hold',     'Wall Handstand Hold',          'static', 3, '{"kind":"hold","sets":3,"seconds":30,"description":"3×30s"}',               'Back to wall; push tall through the shoulders.'),
('chest-to-wall-handstand', 'Chest-to-Wall Handstand',      'static', 4, '{"kind":"hold","sets":3,"seconds":30,"description":"3×30s"}',               'Chest facing the wall, only heels touching; straighter line.'),
('freestanding-handstand',  'Freestanding Handstand',       'static', 5, '{"kind":"hold","sets":3,"seconds":15,"description":"3×15s"}',               'Balance with fingertip pressure; ribs in, glutes tight.'),
('wall-handstand-push-up',  'Wall Handstand Push-Up',       'static', 6, '{"kind":"reps","sets":3,"reps":5,"description":"3×5"}',                     'Head to floor and press back up, heels on the wall.'),
('freestanding-hspu',       'Freestanding Handstand Push-Up','static', 7, '{"kind":"reps","sets":3,"reps":3,"description":"3×3"}',                    'Full press with no wall; ultimate pressing control.'),
('handstand-walk',          'Handstand Walk',               'static', 8, '{"kind":"reps","sets":3,"reps":5,"description":"3×5 m walk"}',              'Shift weight hand to hand; small quick steps, tight body.');
