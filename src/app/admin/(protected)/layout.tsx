import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAppBaseUrl } from "@/lib/env";
import { isProvisionalBaseUrl } from "@/lib/invitations/url";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/households", label: "Households" },
  { href: "/admin/guests", label: "Guests" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/settings", label: "Settings" },
] as const;

/** Every page under this layout requires an authenticated administrator. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdminPage();
  const baseUrl = getAppBaseUrl();
  const provisional = isProvisionalBaseUrl(baseUrl);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin/dashboard" className="font-semibold text-stone-900">
            Wedding admin
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md px-2 py-1 text-stone-700 hover:bg-stone-100">
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={signOut} className="ml-auto flex items-center gap-3 text-sm text-stone-600">
            <span className="hidden sm:inline">{admin.email}</span>
            <button type="submit" className="rounded-md px-2 py-1 hover:bg-stone-100">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {provisional && (
        <div className="border-b border-amber-200 bg-amber-50 print:hidden">
          <p className="mx-auto max-w-6xl px-4 py-2 text-sm text-amber-900">
            Invitation links currently use <strong>{baseUrl}</strong>, which is not a production domain. Use proofs for
            testing only — do not print final invitations until APP_BASE_URL is the real wedding domain.
          </p>
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
