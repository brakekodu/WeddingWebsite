import Link from "next/link";

export default function InvitationNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-serif text-4xl text-stone-900">We couldn&apos;t find that invitation</h1>
      <p className="mt-4 text-stone-600">Please check the link, or enter the RSVP code printed on your invitation.</p>
      <Link
        href="/rsvp"
        className="mt-8 rounded-full border border-stone-900 px-6 py-3 text-sm font-medium text-stone-900 hover:bg-stone-900 hover:text-white"
      >
        Enter RSVP code
      </Link>
    </main>
  );
}
