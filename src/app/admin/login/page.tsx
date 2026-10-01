import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function LoginPage(props: PageProps<"/admin/login">) {
  const configured = isSupabaseConfigured();
  if (configured && (await getAdmin())) redirect("/admin/dashboard");
  const { next } = await props.searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-2xl font-semibold text-stone-900">Wedding admin</h1>
      <p className="mt-1 text-sm text-stone-600">Sign in with your administrator account.</p>
      {configured ? (
        <LoginForm next={typeof next === "string" ? next : undefined} />
      ) : (
        <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          Supabase is not configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and fill in the
          values described in README.md.
        </p>
      )}
    </main>
  );
}
