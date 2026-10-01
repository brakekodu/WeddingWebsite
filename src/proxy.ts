/**
 * Runs before matched routes:
 *   1. Refreshes the Supabase auth session cookie (the documented @supabase/ssr pattern).
 *   2. Sends signed-out visitors on /admin/* to the login page.
 *
 * This is a convenience gate only. Admin authorization is enforced again in
 * the admin layout, in every server action, and by RLS in the database.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Same value as INVITE_COOKIE in src/lib/site/server.ts (proxy code stays self-contained). */
const INVITE_COOKIE = "bw_invite";
const INVITATION_PATH = /^\/i\/([A-Za-z0-9_-]{24})(\/|$)/;

export async function proxy(request: NextRequest) {
  const response = await handle(request);
  // Remember the invitation on this device so public pages can show "Viewing as …".
  const token = request.nextUrl.pathname.match(INVITATION_PATH)?.[1];
  if (token && request.cookies.get(INVITE_COOKIE)?.value !== token) {
    response.cookies.set(INVITE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  return response;
}

async function handle(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLogin = pathname === "/admin/login";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Unset, or still a "REPLACE_WITH_…" placeholder from cloudflare.config.ts.
  if (!url || !key || url.includes("REPLACE_WITH") || key.includes("REPLACE_WITH")) {
    // Not configured yet: the login page explains what to set up.
    if (isAdminArea && !isLogin) return NextResponse.redirect(new URL("/admin/login", request.url));
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [header, value] of Object.entries(headers ?? {})) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // Verifies the JWT and refreshes it if needed. Do not run code between
  // client creation and this call.
  const { data } = await supabase.auth.getClaims();

  if (isAdminArea && !isLogin && !data?.claims) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    login.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(login);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  // Admin pages (auth), invitation pages (so admin previews are recognized).
  matcher: ["/admin/:path*", "/i/:path*"],
};
