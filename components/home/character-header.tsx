import { Avatar } from "@/components/profile/avatar"
import { Progress } from "@/components/ui/progress"
import type { AvatarCharacter } from "@/lib/game/avatar"
import { levelFromXp } from "@/lib/game/level"

export function CharacterHeader({
  displayName,
  totalXp,
  character = "man",
}: {
  displayName: string
  totalXp: number
  character?: AvatarCharacter
}) {
  const { level, intoLevel, nextThreshold, currentThreshold, progress } =
    levelFromXp(totalXp)
  const span = nextThreshold - currentThreshold

  return (
    <section className="flex items-center gap-4" aria-label="Character">
      <div className="relative shrink-0">
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-muted">
          <Avatar level={level} character={character} className="h-full w-auto" />
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
