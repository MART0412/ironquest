"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/** A large tappable selection card — used for activity level and split choice. */
export function OptionCard({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean
  title: string
  description?: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted"
      )}
    >
      <div className="flex-1">
        <p className="font-medium leading-snug">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input"
        )}
      >
        {selected && <Check className="size-3.5" />}
      </span>
    </button>
  )
}
