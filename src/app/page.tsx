import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

// Placeholder until the public wedding site phase. Intentionally minimal.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-serif text-5xl font-medium text-stone-900">{SITE_NAME}</h1>
      <p className="mt-4 text-stone-600">Details are coming soon.</p>
      <Link
        href="/rsvp"
        className="mt-10 rounded-full border border-stone-900 px-6 py-3 text-sm font-medium text-stone-900 hover:bg-stone-900 hover:text-white"
      >
        RSVP with your invitation code
      </Link>
    </main>
  );
}
