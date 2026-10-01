import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAppBaseUrl } from "@/lib/env";
import { formatTimestamp } from "@/lib/format";
import { loadInvitationDetail } from "@/lib/invitations/admin-queries";
import { formatRsvpCode } from "@/lib/invitations/credentials";
import { greetingName, joinNames } from "@/lib/invitations/greeting";
import { generateQrSvg } from "@/lib/invitations/qr";
import { buildInvitationUrl, buildRsvpCodeUrl, isProvisionalBaseUrl } from "@/lib/invitations/url";
import { effectiveValidationStatus } from "@/lib/invitations/validation";
import { coupleNames } from "@/content/site";
import { markPrinted, recordProofPrinted } from "../../actions";
import { PrintButton } from "./print-button";

export const metadata = { title: "Print invitation" };

/**
 * Single-invitation print proof. Deliberately plain, vendor-neutral HTML sized
 * for a 5×7 card, so a physical proof can be printed and its QR code scanned
 * before any bulk printing. Final artwork comes in a later phase.
 */
export default async function PrintInvitationPage(props: PageProps<"/admin/invitations/[id]/print">) {
  const { id } = await props.params;
  const { supabase } = await requireAdminPage();
  const detail = await loadInvitationDetail(supabase, id);
  if (!detail) notFound();

  const { invitation, guests } = detail;
  const baseUrl = getAppBaseUrl();
  const url = buildInvitationUrl(baseUrl, invitation.token);
  const provisional = isProvisionalBaseUrl(baseUrl);
  const validation = effectiveValidationStatus(invitation, baseUrl);
  const isProof = provisional || invitation.status !== "locked" || validation !== "passed";
  const canMarkPrinted = !provisional && invitation.status === "locked" && validation === "passed";
  const lastName = guests.find((g) => g.last_name)?.last_name;
  const names = joinNames(guests.map(greetingName)) + (lastName ? ` ${lastName}` : "");

  return (
    <div className="space-y-6">
      <style>{`@page { size: 5in 7in; margin: 0; }`}</style>

      <div className="space-y-3 print:hidden">
        <Link href={`/admin/invitations/${invitation.id}`} className="text-sm text-stone-600 hover:underline">
          ← Back to invitation
        </Link>
        <h1 className={ui.h1}>Print single invitation</h1>
        {validation !== "passed" && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            QR validation has not passed for the current URL. Validate the QR code before relying on this print.
          </p>
        )}
        {guests.length === 0 && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">This invitation has no guests.</p>
        )}
        {isProof && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            This prints as a <strong>PROOF</strong>
            {provisional && " because APP_BASE_URL is not the production domain"}
            {!provisional && invitation.status !== "locked" && " because the invitation is not locked"}. Scan the
            printed QR code with a phone to confirm it opens this invitation.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <PrintButton />
          <ActionForm
            inline
            variant="secondary"
            action={recordProofPrinted.bind(null, invitation.id)}
            submitLabel="Record proof printed"
          />
          {canMarkPrinted && invitation.print_status !== "printed" && (
            <ActionForm
              inline
              variant="secondary"
              action={markPrinted.bind(null, invitation.id)}
              submitLabel="Mark final print done"
              confirm="Mark this invitation as finally printed? This cannot be undone."
            />
          )}
        </div>
        <p className="text-xs text-stone-500">
          Last proof: {formatTimestamp(invitation.proof_printed_at)} · Final print:{" "}
          {formatTimestamp(invitation.printed_at)}
        </p>
      </div>

      {/* The card: 5in × 7in. On screen it is shown at actual size with a border. */}
      <article className="relative mx-auto flex h-[7in] w-[5in] flex-col items-center justify-between overflow-hidden border border-stone-300 bg-white px-[0.5in] py-[0.6in] text-center text-stone-900 print:border-0">
        {isProof && (
          <div className="absolute top-3 right-0 left-0 text-[10px] font-semibold tracking-[0.3em] text-red-600 uppercase">
            Proof — not for final printing
          </div>
        )}
        <header>
          <p className="text-xs tracking-[0.3em] text-stone-500 uppercase">{coupleNames}</p>
          <h2 className="mt-4 font-serif text-3xl leading-tight">{names || "Guest"}</h2>
          <p className="mt-2 font-serif text-lg text-stone-600">Kindly reply</p>
        </header>

        <div className="w-[2.1in]" dangerouslySetInnerHTML={{ __html: generateQrSvg(url, "Scan to RSVP") }} />

        <footer className="space-y-1 text-[11px] leading-snug text-stone-600">
          <p>Scan the code to RSVP, or visit</p>
          <p className="font-medium text-stone-900">{buildRsvpCodeUrl(baseUrl).replace(/^https?:\/\//, "")}</p>
          <p>and enter your code</p>
          <p className="font-mono text-xl tracking-[0.25em] text-stone-900">{formatRsvpCode(invitation.rsvp_code)}</p>
        </footer>
      </article>
    </div>
  );
}
