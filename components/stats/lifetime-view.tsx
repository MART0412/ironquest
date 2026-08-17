import Link from "next/link"

import {
  achievedMilestones,
  formatConversion,
  METRICS,
  nextMilestone,
  type EquivalenceContext,
  type LifetimeTotals,
  type MetricConfig,
} from "@/lib/game/equivalences"
import { cn } from "@/lib/utils"

const RAW_UNIT: Record<MetricConfig["measure"], string> = {
  reps: "reps",
  seconds: "sec",
  workouts: "logged",
}

function formatRaw(metric: MetricConfig, total: number): string {
  return `${total.toLocaleString("en-US")} ${RAW_UNIT[metric.measure]}`
}

/**
 * Everything you have ever logged, and what it adds up to in the real world.
 * Server-rendered from totals the caller aggregated — this component only
 * decides how the numbers read.
 */
export function LifetimeView({
  totals,
  ctx,
  earnedAt,
}: {
  totals: LifetimeTotals
  ctx: EquivalenceContext
  /** milestone id → when it was recorded, for the achieved list. */
  earnedAt: Record<string, string>
}) {
  const withLadders = METRICS.filter((metric) => metric.milestones.length > 0)
  const hasHistory = Object.values(totals).some((value) => value > 0)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      <header>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          ← Home
        </Link>
        <h1 className="mt-1 font-heading text-2xl font-semibold">Lifetime</h1>
        <p className="text-xs text-muted-foreground">
          Every rep you&apos;ve ever logged, and roughly what it adds up to.
        </p>
      </header>

      {!hasHistory && (
        <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          Nothing logged yet. Finish a workout and this page starts counting —
          retroactively, over everything.
        </p>
      )}

      {/* Raw counters, including the movements that have no ladder yet. */}
      <section aria-label="Totals" className="grid grid-cols-2 gap-2">
        {METRICS.map((metric) => (
          <div
            key={metric.key}
            className="rounded-xl border border-border p-3"
            data-metric={metric.key}
          >
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="font-heading text-xl font-semibold tabular-nums">
              {totals[metric.key].toLocaleString("en-US")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatConversion(metric, totals[metric.key], ctx) ??
                RAW_UNIT[metric.measure]}
            </p>
          </div>
        ))}
      </section>

      {withLadders.map((metric) => (
        <MetricLadder
          key={metric.key}
          metric={metric}
          total={totals[metric.key]}
          ctx={ctx}
          earnedAt={earnedAt}
        />
      ))}

      <p className="text-center text-xs text-muted-foreground">
        Comparisons are deliberately rough — the point is the scale, not the
        decimal places.
      </p>
    </main>
  )
}

function MetricLadder({
  metric,
  total,
  ctx,
  earnedAt,
}: {
  metric: MetricConfig
  total: number
  ctx: EquivalenceContext
  earnedAt: Record<string, string>
}) {
  const next = nextMilestone(metric.key, total)
  const achieved = achievedMilestones(metric.key, total)
  const converted = formatConversion(metric, total, ctx)

  return (
    <section
      aria-label={`${metric.label} milestones`}
      data-ladder={metric.key}
      className="flex flex-col gap-3 rounded-xl border border-border p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-medium">{metric.label}</h2>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatRaw(metric, total)}
          {converted && ` · ≈ ${converted}`}
        </span>
      </div>

      {next ? (
        <div data-next={next.milestone.id}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-medium">{next.milestone.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {total.toLocaleString("en-US")} /{" "}
              {next.milestone.at.toLocaleString("en-US")}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.round(next.progress * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {next.remaining.toLocaleString("en-US")} more to go.
          </p>
        </div>
      ) : (
        <p className="text-xs text-primary">
          Every milestone on this ladder is behind you. More coming.
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {metric.milestones.map((milestone) => {
          const done = achieved.some((ms) => ms.id === milestone.id)
          return (
            <li
              key={milestone.id}
              data-milestone={milestone.id}
              data-achieved={done ? "true" : "false"}
              className={cn(
                "flex items-start gap-2 text-xs",
                done ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span aria-hidden className="w-4 shrink-0 text-center">
                {done ? "✓" : "·"}
              </span>
              <span className="flex-1">
                <span className={cn(done && "font-medium")}>
                  {milestone.label}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  — {milestone.message}
                </span>
                {done && earnedAt[milestone.id] && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({earnedAt[milestone.id]})
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
