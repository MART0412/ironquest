"use server"

import { redirect } from "next/navigation"
import * as z from "zod"

import { createClient } from "@/lib/supabase/server"

export type AuthState = { error?: string; message?: string } | undefined

const credentialsSchema = z.object({
  email: z.email({ error: "Enter a valid email." }),
  password: z
    .string()
    .min(6, { error: "Password must be at least 6 characters." }),
})

function parseCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = parseCredentials(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: "Incorrect email or password." }
  }

  redirect("/")
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = parseCredentials(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp(parsed.data)

  if (error) {
    return { error: error.message }
  }

  // When email confirmation is enabled, no session is returned yet.
  if (!data.session) {
    return {
      message: "Check your email to confirm your account, then sign in.",
    }
  }

  redirect("/")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
