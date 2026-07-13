import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/lib/database.types"

const AUTH_PAGES = ["/login", "/signup"]

/**
 * Refreshes the Supabase auth session cookie on every request and applies coarse,
 * cookie-based route gating (optimistic — no DB queries here, per Next.js 16 proxy guidance).
 *
 * IMPORTANT: do not run logic between `createServerClient` and `getUser()`, and always
 * return the `supabaseResponse` object so refreshed cookies propagate correctly.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p))

  // Unauthenticated users may only reach the auth pages (the /auth/* handler
  // routes are excluded from the proxy via the matcher).
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Signed-in users have no business on the auth pages.
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
