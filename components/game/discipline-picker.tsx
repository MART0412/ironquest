"use client"

import { Check, Lock } from "lucide-react"

import {
  lockMessage,
  type DisciplineOption,
  type DisciplineState,
} from "@/lib/game/disciplines"
import { cn } from "@/lib/utils"

export type { DisciplineOption }

const STATE_NOTE: Record<DisciplineState, string | null> = {
  active: null,
  available: null,
  "coming-soon": "Library coming soon",
  locked: lockMessage(),
}

/**
 * One discipline card. Locked and coming-soon cards stay on screen, greyed —
 * seeing what you haven't earned yet is the point of the gate.
 */
export function DisciplineCard({
  option,
  selected = false,
  action,
  onSelect,
}: {
  option: DisciplineOption
  /** Selection highlight (onboarding), separate from "already active". */
  selected?: boolean
  /** Trailing control, e.g. an Activate button on the profile. */
  action?: React.ReactNode
  onSelect?: () => void
}) {
  const dimmed = option.state === "locked" || option.state === "coming-soon"
  const note = STATE_NOTE[option.state]
  const interactive = !!onSelect && !dimmed && option.state !== "active"

  const body = (
    <>
      <div className="flex-1">
        <p className="flex items-center gap-1.5 font-medium leading-snug">
          {option.name}
          {option.isPrimary && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              primary
            </span>
          )}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{option.tagline}</p>
        {note && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {option.state === "locked" && <Lock className="size-3" />}
            {note}
          </p>
        )}
      </div>
      {action ??
        (option.state === "active" ? (
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </span>
        ) : selected ? (
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground">
            <Check className="size-3.5" />
          </span>
        ) : null)}
    </>
  )

  const className = cn(
    "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    selected || option.state === "active"
      ? "border-primary bg-primary/5"
      : "border-border",
    dimmed && "opacity-55",
    interactive && "hover:bg-muted"
  )

  if (!interactive) {
    return (
      <div
        className={className}
        data-discipline={option.slug}
        data-state={option.state}
        aria-disabled={dimmed || undefined}
      >
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={className}
      data-discipline={option.slug}
      data-state={option.state}
    >
      {body}
    </button>
  )
}

/** The full list, in seed order. */
export function DisciplineList({
  options,
  selectedSlug,
  onSelect,
  renderAction,
}: {
  options: DisciplineOption[]
  selectedSlug?: string
  onSelect?: (slug: string) => void
  renderAction?: (option: DisciplineOption) => React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((option) => (
        <DisciplineCard
          key={option.slug}
          option={option}
          selected={selectedSlug === option.slug}
          action={renderAction?.(option)}
          onSelect={onSelect ? () => onSelect(option.slug) : undefined}
        />
      ))}
    </div>
  )
}
