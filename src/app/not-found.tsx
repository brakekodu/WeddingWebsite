import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-serif text-4xl text-stone-900">Page not found</h1>
      <Link href="/" className="mt-8 text-sm text-stone-700 underline underline-offset-4">
        Go home
      </Link>
    </main>
  );
}
