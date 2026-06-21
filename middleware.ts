import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Lightweight auth gate. Runs in the Edge runtime, so it must never throw —
 * a thrown error here 500s every route (MIDDLEWARE_INVOCATION_FAILED).
 *
 * It tries to refresh the Supabase session (the recommended pattern), but if
 * anything fails (missing env, Edge/supabase quirk, network) it falls back to
 * a cheap cookie-presence check. The real validation happens in the
 * (dashboard) layout, which runs in Node where supabase-js is fully supported.
 */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.includes("-auth-token"));
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login");

  let response = NextResponse.next({ request });
  let isLoggedIn = false;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const supabase = createServerClient(url, key, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });
      const {
        data: { user },
      } = await supabase.auth.getUser();
      isLoggedIn = !!user;
    } else {
      isLoggedIn = hasAuthCookie(request);
    }
  } catch {
    // Never 500 the site — fall back to cookie presence.
    isLoggedIn = hasAuthCookie(request);
  }

  if (!isLoggedIn && !isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }
  if (isLoggedIn && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!q/|api/collect|track.js|quizzes/|_next/static|_next/image|favicon.ico).*)",
  ],
};
