import { Crown, Flame, Shield, Swords } from "lucide-react"

import { Progress } from "@/components/ui/progress"
import { levelFromXp } from "@/lib/game/level"

/**
 * Placeholder tier avatar — art direction is undecided (spec open decision #2),
 * so the icon steps with level brackets and swaps out wholesale later.
 */
function tierIcon(level: number) {
  if (level >= 20) return Crown
  if (level >= 10) return Flame
  if (level >= 5) return Shield
  return Swords
}

export function CharacterHeader({
  displayName,
  totalXp,
}: {
  displayName: string
  totalXp: number
}) {
  const { level, intoLevel, nextThreshold, currentThreshold, progress } =
    levelFromXp(totalXp)
  const span = nextThreshold - currentThreshold
  const Icon = tierIcon(level)

  return (
    <section className="flex items-center gap-4" aria-label="Character">
      <div className="relative shrink-0">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Icon className="size-7 text-foreground" aria-hidden />
        </div>
        <span className="absolute -right-1 -bottom-1 rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
          {level}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-xl font-semibold">
          {displayName}
        </h1>
        <p className="text-xs text-muted-foreground">Level {level}</p>
        <Progress value={progress * 100} className="mt-1.5 h-2" />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {intoLevel} / {span} XP to level {level + 1}
        </p>
      </div>
    </section>
  )
}
