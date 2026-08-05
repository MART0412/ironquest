"use client"

import { Button } from "@/components/ui/button"

/**
 * ±1 numeric stepper used by check-off's adjuster and the challenge attempt
 * panel — same shape everywhere so adjusting a prescription always feels the
 * same.
 */
export function Stepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (delta: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(-1)}
        >
          −
        </Button>
        <span className="w-8 text-center font-medium tabular-nums">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(1)}
        >
          +
        </Button>
      </div>
    </div>
  )
}
