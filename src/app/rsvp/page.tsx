import type { Metadata } from "next";
import { RsvpCodeForm } from "./rsvp-code-form";

export const metadata: Metadata = {
  title: "RSVP",
  robots: { index: false, follow: false },
};

/** Fallback for guests who can't scan the QR code: type the printed code. */
export default function RsvpCodePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16 text-center">
      <h1 className="font-serif text-4xl text-stone-900">RSVP</h1>
      <p className="mt-3 text-stone-600">Enter the RSVP code printed on your invitation.</p>
      <RsvpCodeForm />
    </main>
  );
}
