"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Avatar } from "@/components/profile/avatar"
import { setAvatarCharacter } from "@/lib/actions/profile"
import type { AvatarCharacter } from "@/lib/game/avatar"
import { cn } from "@/lib/utils"

const OPTIONS: { value: AvatarCharacter; label: string }[] = [
  { value: "man", label: "Masculine" },
  { value: "woman", label: "Feminine" },
]

/** Free character toggle — each option previews its own base figure. */
export function CharacterPicker({
  current,
  level,
}: {
  current: AvatarCharacter
  level: number
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<AvatarCharacter>(current)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function choose(value: AvatarCharacter) {
    if (value === selected) return
    setSelected(value) // optimistic
    setError(null)
    startTransition(async () => {
      const res = await setAvatarCharacter(value)
      if ("error" in res) {
        setError(res.error)
        setSelected(current) // revert
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Character">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected === opt.value}
            aria-label={`${opt.label} figure`}
            disabled={pending}
            onClick={() => choose(opt.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected === opt.value
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted",
              pending && "opacity-60"
            )}
          >
            <span className="flex h-16 w-12 items-center justify-center">
              <Avatar level={level} character={opt.value} className="h-full w-auto" />
            </span>
            <span className="text-xs font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
