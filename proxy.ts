import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

// Next.js 16 renamed Middleware -> Proxy. This runs on every request (except the
// paths excluded below) to keep the Supabase session fresh and gate routes.
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (build assets)
     * - favicon and common static image types
     * - /auth (OAuth / code-exchange route handler must run without gating)
     */
    "/((?!_next/static|_next/image|favicon.ico|auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
