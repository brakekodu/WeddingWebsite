import { SectionLabel } from "@/components/site/parts";
import { s } from "@/components/site/styles";
import { couple } from "@/content/site";
import { RsvpCodeForm } from "@/app/(site)/rsvp/rsvp-code-form";
import { getSiteContent } from "@/lib/site/server";

/** Invalid or revoked invitation. Never reveals whose link it was. */
export default async function InvitationNotFound() {
  const site = await getSiteContent();
  return (
    <main className="flex-1 px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <SectionLabel>{couple.monogram}</SectionLabel>
          <h1 className={`${s.h1} mt-3`}>We couldn&apos;t open that invitation</h1>
          <p className="mt-3 text-muted">Enter the 6-character code printed on the back of your invitation instead.</p>
        </div>
        <RsvpCodeForm />
        <p className="text-sm text-muted">
          Still stuck? Email{" "}
          <a href={`mailto:${site.basics.contactEmail}`} className="underline underline-offset-4">
            {site.basics.contactEmail}
          </a>{" "}
          and we&apos;ll send your link.
        </p>
      </div>
    </main>
  );
}
