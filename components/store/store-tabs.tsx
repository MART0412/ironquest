"use client"

import Link from "next/link"
import { useState } from "react"

import { CosmeticsTab, type CosmeticRow } from "@/components/store/cosmetics-tab"
import { RewardsTab, type RewardRow } from "@/components/store/rewards-tab"
import { cn } from "@/lib/utils"

type Tab = "rewards" | "cosmetics"

export function StoreTabs({
  balance,
  rewards,
  cosmetics,
}: {
  balance: number
  rewards: RewardRow[]
  cosmetics: CosmeticRow[]
}) {
  const [tab, setTab] = useState<Tab>("rewards")

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
            ← Home
          </Link>
          <h1 className="mt-1 font-heading text-2xl font-semibold">Store</h1>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums">{balance}</p>
          <p className="text-xs text-muted-foreground">points</p>
        </div>
      </header>

      <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
        {(
          [
            ["rewards", "Real-life"],
            ["cosmetics", "Cosmetics"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-md py-1.5 text-sm transition-colors",
              tab === key ? "bg-background font-medium shadow-sm" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "rewards" ? (
        <RewardsTab balance={balance} rewards={rewards} />
      ) : (
        <CosmeticsTab balance={balance} cosmetics={cosmetics} />
      )}
    </main>
  )
}
