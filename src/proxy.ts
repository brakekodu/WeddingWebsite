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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLogin = pathname === "/admin/login";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
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
