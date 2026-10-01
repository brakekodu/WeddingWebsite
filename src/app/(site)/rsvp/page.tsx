import type { Metadata } from "next";
import { PhotoPlaceholder, SectionLabel } from "@/components/site/parts";
import { s } from "@/components/site/styles";
import { site } from "@/content/site";
import { RsvpCodeForm } from "./rsvp-code-form";

export const metadata: Metadata = { title: "RSVP", robots: { index: false, follow: false } };

/** Find your invitation (screen 13). A code is the only way in — no name search. */
export default function RsvpCodePage() {
  return (
    <section className="px-5 py-14 sm:py-20">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <SectionLabel>RSVP</SectionLabel>
          <h1 className={`${s.h1} mt-3`}>Find your invitation</h1>
          <p className="mt-3 text-muted">Enter the 6-character code printed on the back of your invitation.</p>
        </div>
        <RsvpCodeForm />
        <PhotoPlaceholder label="card back · code here" className="h-28" />
        <p className="text-sm text-muted">
          Have your invitation? Scanning its QR code with your phone camera skips this step.
        </p>
        <p className="text-sm text-muted">
          Lost your invitation? Email us at{" "}
          <a href={`mailto:${site.contactEmail}`} className="underline underline-offset-4">
            {site.contactEmail}
          </a>{" "}
          and we&apos;ll send your link.
        </p>
      </div>
    </section>
  );
}
