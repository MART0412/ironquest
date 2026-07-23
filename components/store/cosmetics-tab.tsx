"use client"

import { Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Avatar } from "@/components/profile/avatar"
import { Button } from "@/components/ui/button"
import {
  equipCosmetic,
  purchaseCosmetic,
  unequipCosmetic,
} from "@/lib/actions/cosmetics"
import { cn } from "@/lib/utils"

export type CosmeticRow = {
  id: string
  slug: string
  name: string
  type: "title" | "theme" | "gear" | "ui_theme"
  costPoints: number
  accent: string | null
  slot: string | null
  /** ui_theme preview colors (from metadata.vars). */
  preview: { bg: string; primary: string; accent: string } | null
  owned: boolean
  equipped: boolean
}

const GROUPS: { type: CosmeticRow["type"]; label: string; blurb: string }[] = [
  { type: "ui_theme", label: "App themes", blurb: "One active — reskins the whole app." },
  { type: "title", label: "Titles", blurb: "One active — shown under your name." },
  { type: "theme", label: "Profile accents", blurb: "One active — recolors your profile." },
  { type: "gear", label: "Gear", blurb: "Stacks — layers onto your avatar." },
]

export function CosmeticsTab({
  balance,
  cosmetics,
}: {
  balance: number
  cosmetics: CosmeticRow[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function buy(c: CosmeticRow) {
    setError(null)
    startTransition(async () => {
      const res = await purchaseCosmetic(c.id)
      if ("error" in res) setError(res.error)
      else router.refresh()
    })
  }
  function equip(c: CosmeticRow) {
    setError(null)
    startTransition(async () => {
      const res = await equipCosmetic(c.id)
      if ("error" in res) setError(res.error)
      else router.refresh()
    })
  }
  function unequip(c: CosmeticRow) {
    setError(null)
    startTransition(async () => {
      const res = await unequipCosmetic(c.id)
      if ("error" in res) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {GROUPS.map((group) => {
        const items = cosmetics.filter((c) => c.type === group.type)
        if (items.length === 0) return null
        return (
          <section key={group.type} className="flex flex-col gap-3">
            <div>
              <h2 className="font-heading text-lg font-medium">{group.label}</h2>
              <p className="text-xs text-muted-foreground">{group.blurb}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {items.map((c) => (
                <li
                  key={c.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    c.equipped ? "border-primary bg-primary/5" : "border-border"
                  )}
                >
                  <CosmeticSwatch cosmetic={c} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.owned ? "Owned" : `${c.costPoints} pts`}
                    </p>
                  </div>

                  {!c.owned ? (
                    <Button
                      size="sm"
                      disabled={balance < c.costPoints || pending}
                      onClick={() => buy(c)}
                    >
                      {balance < c.costPoints ? `Need ${c.costPoints - balance}` : "Buy"}
                    </Button>
                  ) : c.equipped ? (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => unequip(c)}>
                      <Check data-icon="inline-start" />
                      Equipped
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => equip(c)}>
                      Equip
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

/** Preview: ui_theme = palette chip, theme = accent dot, gear = avatar, title = initial. */
function CosmeticSwatch({ cosmetic }: { cosmetic: CosmeticRow }) {
  if (cosmetic.type === "ui_theme" && cosmetic.preview) {
    return (
      <span
        className="flex size-9 shrink-0 items-center justify-center gap-0.5 rounded-lg border border-border p-1"
        style={{ backgroundColor: cosmetic.preview.bg }}
        aria-hidden
      >
        <span className="h-4 w-1.5 rounded-sm" style={{ backgroundColor: cosmetic.preview.primary }} />
        <span className="h-4 w-1.5 rounded-sm" style={{ backgroundColor: cosmetic.preview.accent }} />
      </span>
    )
  }
  if (cosmetic.type === "theme" && cosmetic.accent) {
    return (
      <span
        className="size-9 shrink-0 rounded-full border border-border"
        style={{ backgroundColor: cosmetic.accent }}
        aria-hidden
      />
    )
  }
  if (cosmetic.type === "gear" && cosmetic.slot) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
        <Avatar level={10} gearSlots={[cosmetic.slot]} className="h-full w-auto" />
      </span>
    )
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-heading text-sm font-semibold">
      {cosmetic.name.charAt(0)}
    </span>
  )
}
