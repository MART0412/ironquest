import { Check } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export type QuestRoutine = {
  id: string
  name: string
  itemCount: number
  done: boolean
}

export function QuestCard({
  routines,
  isRestDay,
}: {
  routines: QuestRoutine[]
  isRestDay: boolean
}) {
  const allDone = routines.length > 0 && routines.every((r) => r.done)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s quest</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isRestDay ? (
          <p className="text-sm text-muted-foreground">
            Scheduled rest day — recovery counts. Log your meals to keep the
            streak alive.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {routines.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.itemCount} exercise{r.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                {r.done ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Check className="size-3.5" /> Done
                  </span>
                ) : (
                  <Link
                    href="/workout"
                    className={buttonVariants({ size: "sm" })}
                  >
                    Start
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        {allDone && (
          <p className="text-sm text-muted-foreground">
            Quest complete — see you tomorrow. 💪
          </p>
        )}
        {isRestDay && (
          <Link
            href="/workout"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Bonus workout anyway
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
