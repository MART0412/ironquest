import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/database.types"

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads/writes the auth session from the request cookies. `cookies()` is async
 * in Next.js 16, so this factory is async too.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component where cookies are read-only.
            // The session refresh in proxy.ts keeps cookies current, so this is safe to ignore.
          }
        },
      },
    }
  )
}
