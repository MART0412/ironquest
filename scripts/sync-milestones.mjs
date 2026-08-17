// Mirror the milestone catalog from lib/game/equivalences.ts into the
// equivalence_milestones table that complete_workout reads.
//
// The TS config is the authoring surface; this table is a derived cache of the
// numbers only (id, metric, threshold, xp, points). Adding a milestone is an
// edit to the config plus a run of this script — never a migration.
//
//   npm run sync:milestones            upsert the catalog (needs the service key)
//   npm run sync:milestones -- --check read-only drift report (publishable key)
//   npm run sync:milestones -- --sql   print the idempotent SQL instead
//
// The service-role key is read from SUPABASE_SERVICE_ROLE_KEY (put it in
// .env.local, which is gitignored). Without it, --check and --sql still work.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { METRICS } from "../lib/game/equivalences.ts"

const ROOT = new URL("../", import.meta.url)
const args = new Set(process.argv.slice(2))

/** Flat catalog rows, in ladder order, exactly as the table stores them. */
const rows = METRICS.flatMap((metric, metricIndex) =>
  metric.milestones.map((ms, rung) => ({
    id: ms.id,
    metric: metric.key,
    threshold: ms.at,
    xp: ms.xp,
    points: ms.points,
    sort_order: metricIndex * 100 + rung,
  }))
)

/** Read a key out of .env.local without pulling in a dotenv dependency. */
function envFromFile(name) {
  if (process.env[name]) return process.env[name]
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(fileURLToPath(new URL(file, ROOT)), "utf8")
      const match = text.match(new RegExp(`^${name}\\s*=\\s*(.+)$`, "m"))
      if (match) return match[1].trim().replace(/^["']|["']$/g, "")
    } catch {
      // No such file — try the next one.
    }
  }
  return undefined
}

const SUPABASE_URL = envFromFile("NEXT_PUBLIC_SUPABASE_URL")
const PUBLISHABLE = envFromFile("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
const SERVICE_KEY = envFromFile("SUPABASE_SERVICE_ROLE_KEY")

function sql() {
  const values = rows
    .map(
      (r) =>
        `  ('${r.id}', '${r.metric}', ${r.threshold}, ${r.xp}, ${r.points}, ${r.sort_order})`
    )
    .join(",\n")
  return `insert into public.equivalence_milestones (id, metric, threshold, xp, points, sort_order)
values
${values}
on conflict (id) do update
  set metric = excluded.metric,
      threshold = excluded.threshold,
      xp = excluded.xp,
      points = excluded.points,
      sort_order = excluded.sort_order;`
}

async function fetchCatalog(key) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/equivalence_milestones?select=id,metric,threshold,xp,points,sort_order&order=sort_order`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  )
  if (!response.ok) {
    throw new Error(`read failed: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

/** Differences between the config and what the database currently holds. */
function drift(remote) {
  const byId = new Map(remote.map((r) => [r.id, r]))
  const added = []
  const changed = []
  for (const row of rows) {
    const found = byId.get(row.id)
    if (!found) {
      added.push(row.id)
      continue
    }
    const same =
      Number(found.threshold) === row.threshold &&
      found.xp === row.xp &&
      found.points === row.points &&
      found.metric === row.metric
    if (!same) changed.push(row.id)
  }
  const configIds = new Set(rows.map((r) => r.id))
  const orphaned = remote.filter((r) => !configIds.has(r.id)).map((r) => r.id)
  return { added, changed, orphaned }
}

if (args.has("--sql")) {
  console.log(sql())
  process.exit(0)
}

if (!SUPABASE_URL) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not set — cannot reach the project.")
  process.exit(1)
}

if (args.has("--check")) {
  if (!PUBLISHABLE) {
    console.error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.")
    process.exit(1)
  }
  const remote = await fetchCatalog(PUBLISHABLE)
  const { added, changed, orphaned } = drift(remote)
  console.log(`config: ${rows.length} milestones · database: ${remote.length}`)
  if (added.length) console.log(`  missing in db: ${added.join(", ")}`)
  if (changed.length) console.log(`  numbers differ: ${changed.join(", ")}`)
  if (orphaned.length) console.log(`  in db but not in config: ${orphaned.join(", ")}`)
  const clean = !added.length && !changed.length && !orphaned.length
  console.log(clean ? "in sync ✓" : "out of sync — run: npm run sync:milestones")
  process.exit(clean ? 0 : 1)
}

if (!SERVICE_KEY) {
  console.error(
    [
      "SUPABASE_SERVICE_ROLE_KEY is not set, so the catalog can't be written.",
      "Add it to .env.local (Supabase dashboard → Project Settings → API), or run",
      "  npm run sync:milestones -- --sql",
      "and apply the printed statement yourself.",
    ].join("\n")
  )
  process.exit(1)
}

const response = await fetch(
  `${SUPABASE_URL}/rest/v1/equivalence_milestones?on_conflict=id`,
  {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  }
)

if (!response.ok) {
  console.error(`sync failed: ${response.status} ${await response.text()}`)
  process.exit(1)
}

console.log(`synced ${rows.length} milestones`)
const remote = await fetchCatalog(SERVICE_KEY)
const { orphaned } = drift(remote)
if (orphaned.length) {
  console.log(
    `note: ${orphaned.length} row(s) in the database are no longer in the config ` +
      `(${orphaned.join(", ")}). They were left alone — delete them by hand if a ` +
      `milestone was truly retired, but remember earned rows reference them.`
  )
}
