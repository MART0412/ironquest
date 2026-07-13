"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export function GoogleButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    })
    if (error) setLoading(false) // otherwise the browser is redirecting away
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-11"
      onClick={handleClick}
      disabled={loading}
    >
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.344-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c7.065 0 11.751-4.966 11.751-11.955 0-.803-.086-1.417-.191-2.03z"
        />
      </svg>
      {loading ? "Redirecting…" : "Continue with Google"}
    </Button>
  )
}
