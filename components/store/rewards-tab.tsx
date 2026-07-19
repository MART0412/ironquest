"use client"

import { Archive, ArchiveRestore, Pencil, Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  archiveReward,
  createReward,
  redeemReward,
  updateReward,
  type RedeemResult,
} from "@/lib/actions/rewards"
import { MX_TZ } from "@/lib/game/streak"
import { cn } from "@/lib/utils"

export type RewardRow = {
  id: string
  title: string
  costPoints: number
  note: string | null
  redeemedAt: string | null
  archivedAt: string | null
}

const dateFmt = new Intl.DateTimeFormat("en", {
  timeZone: MX_TZ,
  year: "numeric",
  month: "short",
  day: "numeric",
})

type FormState = { id: string | null; title: string; cost: string; note: string }
const EMPTY_FORM: FormState = { id: null, title: "", cost: "", note: "" }

export function RewardsTab({
  balance,
  rewards,
}: {
  balance: number
  rewards: RewardRow[]
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormState | null>(null)
  const [confirming, setConfirming] = useState<RewardRow | null>(null)
  const [redeemed, setRedeemed] = useState<
    (RedeemResult & { title: string }) | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const { active, archived, history } = useMemo(() => {
    const active: RewardRow[] = []
    const archived: RewardRow[] = []
    const history: RewardRow[] = []
    for (const r of rewards) {
      if (r.redeemedAt) history.push(r)
      else if (r.archivedAt) archived.push(r)
      else active.push(r)
    }
    history.sort((a, b) => (a.redeemedAt! < b.redeemedAt! ? 1 : -1))
    return { active, archived, history }
  }, [rewards])

  function submitForm() {
    if (!form) return
    setError(null)
    const payload = {
      title: form.title,
      costPoints: Number(form.cost),
      note: form.note || undefined,
    }
    startTransition(async () => {
      const res = form.id
        ? await updateReward(form.id, payload)
        : await createReward(payload)
      if ("error" in res) setError(res.error)
      else {
        setForm(null)
        router.refresh()
      }
    })
  }

  function confirmRedeem() {
    if (!confirming) return
    setError(null)
    const reward = confirming
    startTransition(async () => {
      const res = await redeemReward(reward.id)
      if ("error" in res) {
        setError(res.error)
        setConfirming(null)
      } else {
        setConfirming(null)
        setRedeemed({ ...res.result, title: reward.title })
        router.refresh()
      }
    })
  }

  function toggleArchive(reward: RewardRow, archived: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await archiveReward(reward.id, archived)
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

      {redeemed && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm" role="status">
          <p className="font-medium">🎉 Redeemed: {redeemed.title}</p>
          <p className="mt-1 text-muted-foreground">
            {redeemed.balance_before} → {redeemed.balance_after} points. Enjoy — you earned it.
          </p>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-medium">Your rewards</h2>
          {!form && (
            <Button size="sm" onClick={() => setForm({ ...EMPTY_FORM })}>
              <Plus data-icon="inline-start" />
              New
            </Button>
          )}
        </div>

        {active.length === 0 && !form && (
          <p className="text-sm text-muted-foreground">
            No rewards yet. Define something worth grinding for.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {active.map((r) => {
            const affordable = balance >= r.costPoints
            return (
              <li key={r.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.title}</p>
                    {r.note && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{r.note}</p>
                    )}
                    <p className="mt-1 text-sm font-medium tabular-nums">
                      {r.costPoints} pts
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Edit"
                      onClick={() =>
                        setForm({
                          id: r.id,
                          title: r.title,
                          cost: String(r.costPoints),
                          note: r.note ?? "",
                        })
                      }
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Archive"
                      onClick={() => toggleArchive(r, true)}
                      disabled={pending}
                    >
                      <Archive />
                    </Button>
                  </div>
                </div>
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  disabled={!affordable || pending}
                  onClick={() => setConfirming(r)}
                >
                  {affordable ? "Redeem" : `Need ${r.costPoints - balance} more`}
                </Button>
              </li>
            )
          })}
        </ul>
      </section>

      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-sm font-medium text-muted-foreground">
            Archived
          </h2>
          <ul className="flex flex-col gap-2">
            {archived.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 opacity-70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.costPoints} pts</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleArchive(r, false)}
                  disabled={pending}
                >
                  <ArchiveRestore data-icon="inline-start" />
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-medium">Redemption history</h2>
          <ul className="flex flex-col gap-2">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateFmt.format(new Date(r.redeemedAt!))}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  −{r.costPoints} pts
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {form && (
        <RewardForm
          form={form}
          onChange={setForm}
          onSubmit={submitForm}
          onCancel={() => {
            setForm(null)
            setError(null)
          }}
          pending={pending}
        />
      )}

      {confirming && (
        <ConfirmRedeem
          reward={confirming}
          balance={balance}
          pending={pending}
          onConfirm={confirmRedeem}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}

function RewardForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  pending,
}: {
  form: FormState
  onChange: (f: FormState) => void
  onSubmit: () => void
  onCancel: () => void
  pending: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative mx-auto flex w-full max-w-sm flex-col gap-4 rounded-t-2xl border border-border bg-background p-6 pb-8">
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <h2 className="font-heading text-xl font-semibold">
          {form.id ? "Edit reward" : "New reward"}
        </h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="reward-title">Title</Label>
          <Input
            id="reward-title"
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            placeholder="Bottle of good whiskey"
            className="h-11"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reward-cost">Cost (points)</Label>
          <Input
            id="reward-cost"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.cost}
            onChange={(e) => onChange({ ...form, cost: e.target.value })}
            placeholder="500"
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reward-note">Note (optional)</Label>
          <Input
            id="reward-note"
            value={form.note}
            onChange={(e) => onChange({ ...form, note: e.target.value })}
            placeholder="Only the good stuff"
            className="h-11"
          />
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Pricing guide</p>
          <p className="mt-1">
            Roughly <span className="font-medium">1 point ≈ 1 committed action</span>, so a
            500-pt reward is about 6–8 weeks of consistency.
          </p>
          <p className="mt-1">
            Examples: whiskey ~500 · omakase night ~800 · new gadget ~2,000.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={onSubmit}
            disabled={pending || !form.title.trim() || !form.cost}
          >
            {pending ? "Saving…" : form.id ? "Save" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConfirmRedeem({
  reward,
  balance,
  pending,
  onConfirm,
  onCancel,
}: {
  reward: RewardRow
  balance: number
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const after = balance - reward.costPoints
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative mx-auto flex w-full max-w-sm flex-col gap-4 rounded-t-2xl border border-border bg-background p-6 pb-8">
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="flex items-start justify-between">
          <h2 className="font-heading text-xl font-semibold">Redeem “{reward.title}”?</h2>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onCancel}>
            <X />
          </Button>
        </div>

        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cost</span>
            <span className="font-medium tabular-nums">−{reward.costPoints} pts</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-medium tabular-nums">
              {balance} <span className="text-muted-foreground">→</span> {after}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          This logs the redemption to your receipt trail. It can&apos;t be undone.
        </p>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={pending}>
            {pending ? "Redeeming…" : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  )
}
