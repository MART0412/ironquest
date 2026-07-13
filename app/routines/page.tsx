import Link from "next/link"
import { redirect } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TemplateButton } from "@/components/routines/template-button"
import { SPLIT_TEMPLATES, WEEKDAYS } from "@/lib/data/splits"
import { createClient } from "@/lib/supabase/server"

export default async function RoutinesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: routines } = await supabase
    .from("routines")
    .select("id, name, day_of_week, routine_items(id)")
    .order("created_at", { ascending: true })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-muted-foreground underline underline-offset-4">
            ← Home
          </Link>
          <h1 className="mt-1 font-heading text-2xl font-semibold">Routines</h1>
        </div>
        <Link href="/routines/new" className={buttonVariants({ size: "sm" })}>
          New routine
        </Link>
      </header>

      {routines && routines.length > 0 ? (
        <section className="flex flex-col gap-3">
          {routines.map((r) => (
            <Link key={r.id} href={`/routines/${r.id}`}>
              <Card size="sm" className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{r.name}</CardTitle>
                  <CardDescription>
                    {r.routine_items.length} exercise
                    {r.routine_items.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1">
                    {WEEKDAYS.map(({ key, label }) => {
                      const active = r.day_of_week.includes(key)
                      return (
                        <span
                          key={key}
                          className={
                            "flex-1 rounded-md py-1 text-center text-[10px] " +
                            (active
                              ? "bg-primary/15 font-medium text-foreground"
                              : "bg-muted text-muted-foreground")
                          }
                        >
                          {label}
                        </span>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          No routines yet — start from a template below or build your own.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">Start from a template</h2>
        <p className="text-sm text-muted-foreground">
          One tap creates the split&apos;s routines and sets it as your active
          split. Existing routines with the same name are kept, not duplicated.
        </p>
        {SPLIT_TEMPLATES.map((s) => (
          <TemplateButton
            key={s.key}
            splitKey={s.key}
            name={s.name}
            description={s.description}
          />
        ))}
      </section>
    </main>
  )
}
