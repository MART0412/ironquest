"use client"

import Link from "next/link"
import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleButton } from "@/components/auth/google-button"
import type { AuthState } from "@/lib/actions/auth"

type Mode = "signin" | "signup"

const COPY: Record<
  Mode,
  { title: string; cta: string; altText: string; altHref: string; altLink: string }
> = {
  signin: {
    title: "Welcome back",
    cta: "Sign in",
    altText: "New here?",
    altHref: "/signup",
    altLink: "Create an account",
  },
  signup: {
    title: "Create your account",
    cta: "Sign up",
    altText: "Already have an account?",
    altHref: "/login",
    altLink: "Sign in",
  },
}

export function AuthForm({
  mode,
  action,
}: {
  mode: Mode
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const copy = COPY[mode]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-heading text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">
          IronQuest — train, eat, level up.
        </p>
      </div>

      <GoogleButton />

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
            className="h-11"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p className="text-sm text-muted-foreground" role="status">
            {state.message}
          </p>
        )}

        <Button type="submit" size="lg" className="h-11" disabled={pending}>
          {pending ? "Please wait…" : copy.cta}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {copy.altText}{" "}
        <Link href={copy.altHref} className="font-medium text-foreground underline underline-offset-4">
          {copy.altLink}
        </Link>
      </p>
    </div>
  )
}
