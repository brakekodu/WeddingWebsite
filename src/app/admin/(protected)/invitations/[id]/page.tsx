import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { StatusBadge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAppBaseUrl } from "@/lib/env";
import { formatTimestamp } from "@/lib/format";
import { loadInvitationDetail, sharedVisibilityWarnings } from "@/lib/invitations/admin-queries";
import { formatRsvpCode } from "@/lib/invitations/credentials";
import { fullName } from "@/lib/invitations/greeting";
import { generateQrSvg } from "@/lib/invitations/qr";
import { buildInvitationUrl, buildRsvpCodeUrl, isProvisionalBaseUrl } from "@/lib/invitations/url";
import { effectiveValidationStatus, type QrValidationResult } from "@/lib/invitations/validation";
import {
  addGuestsToInvitation,
  checkQr,
  lockInvitation,
  regenerateToken,
  removeGuestFromInvitation,
  restoreInvitation,
  updateInvitation,
  voidInvitation,
} from "../actions";
import { QrTools, ValidationChecks } from "../qr-tools";

export const metadata = { title: "Invitation" };

const ACTIVITY_LABELS: Record<string, string> = {
  invitation_accessed: "Opened invitation",
  rsvp_started: "Started RSVP",
  rsvp_completed: "Submitted RSVP",
  rsvp_updated: "Updated RSVP",
};

function storedValidation(details: unknown): QrValidationResult | null {
  return details && typeof details === "object" && Array.isArray((details as QrValidationResult).checks)
    ? (details as QrValidationResult)
    : null;
}

export default async function InvitationPage(props: PageProps<"/admin/invitations/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdminPage();
  const detail = await loadInvitationDetail(supabase, id);
  if (!detail) notFound();

  const { invitation, guests, events, assignments, rsvps, meals, activity } = detail;
  const baseUrl = getAppBaseUrl();
  const url = buildInvitationUrl(baseUrl, invitation.token);
  const provisional = isProvisionalBaseUrl(baseUrl);
  const validation = effectiveValidationStatus(invitation, baseUrl);
  const lastValidation = storedValidation(invitation.validation_details);
  const isDraft = invitation.status === "draft";
  const title = invitation.label ?? invitation.households?.display_name ?? "Untitled invitation";

  const assigned = new Set(assignments.map((a) => `${a.guest_id}:${a.event_id}`));
  const visibleEvents = events.filter((e) => assignments.some((a) => a.event_id === e.id));
  const statusOf = (g: string, e: string) =>
    rsvps.find((r) => r.guest_id === g && r.event_id === e)?.status ?? "pending";
  const mealOf = (g: string, e: string) => meals.find((m) => m.guest_id === g && m.event_id === e)?.meal_options?.name;
  const visibilityWarnings = sharedVisibilityWarnings(detail);

  const [{ data: allGuests }, { data: households }] = await Promise.all([
    supabase
      .from("guests")
      .select("id, first_name, last_name, household_id")
      .order("last_name", { nullsFirst: false })
      .order("first_name"),
    supabase.from("households").select("id, display_name").order("display_name"),
  ]);
  const onInvitation = new Set(guests.map((g) => g.id));
  const candidates = (allGuests ?? [])
    .filter((g) => !onInvitation.has(g.id))
    // Same-household guests first.
    .sort(
      (a, b) => Number(b.household_id === invitation.household_id) - Number(a.household_id === invitation.household_id),
    );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/invitations" className="text-sm text-stone-600 hover:underline">
          ← Invitations
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={ui.h1}>{title}</h1>
          <StatusBadge status={invitation.status} />
          <StatusBadge status={validation} />
          <StatusBadge status={invitation.print_status} />
        </div>
        {invitation.households && (
          <Link
            href={`/admin/households/${invitation.households.id}`}
            className="text-sm text-stone-600 hover:underline"
          >
            {invitation.households.display_name}
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <section className={ui.card}>
            <h2 className={`${ui.h2} mb-3`}>Link and codes</h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-stone-500">Personalized URL (what the QR code opens)</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-stone-100 px-2 py-1 break-all">{url}</code>
                  <CopyButton value={url} />
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Fallback RSVP code (typed at {buildRsvpCodeUrl(baseUrl)})</dt>
                <dd className="mt-1 font-mono text-2xl tracking-widest">{formatRsvpCode(invitation.rsvp_code)}</dd>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-stone-500">Generated</dt>
                  <dd>{formatTimestamp(invitation.generated_at)}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Locked</dt>
                  <dd>{invitation.locked_at ? formatTimestamp(invitation.locked_at) : "Not locked"}</dd>
                </div>
              </div>
            </dl>
          </section>

          <section className={ui.card}>
            <h2 className={`${ui.h2} mb-3`}>Guests on this invitation</h2>
            {guests.length === 0 ? (
              <p className="text-sm text-amber-700">No guests yet. Add at least one guest below.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {guests.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <Link href={`/admin/guests/${g.id}`} className={ui.link}>
                        {fullName(g)}
                      </Link>
                      {detail.guestsOnOtherInvitations.has(g.id) && (
                        <span className="ml-2 text-xs text-amber-700">also on another invitation</span>
                      )}
                      {!assignments.some((a) => a.guest_id === g.id) && (
                        <span className="ml-2 text-xs text-amber-700">not invited to any events</span>
                      )}
                    </span>
                    <ActionForm
                      inline
                      variant="secondary"
                      action={removeGuestFromInvitation.bind(null, invitation.id, g.id)}
                      submitLabel="Remove"
                      confirm={`Remove ${fullName(g)} from this invitation?`}
                    />
                  </li>
                ))}
              </ul>
            )}

            {visibilityWarnings.length > 0 && (
              <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Shared invitation privacy check</p>
                <p>Everyone on an invitation sees all of its events. On this invitation:</p>
                <ul className="mt-1 list-disc pl-5">
                  {visibilityWarnings.map((w) => (
                    <li key={w.event}>
                      <strong>{w.event}</strong> will be visible to {w.notInvited.join(", ")}, who{" "}
                      {w.notInvited.length > 1 ? "are" : "is"} not invited to it (they won&apos;t be asked to RSVP for
                      it).
                    </li>
                  ))}
                </ul>
                <p className="mt-1">If an event must stay private, put those guests on separate invitations.</p>
              </div>
            )}

            {candidates.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-stone-800">Add guests</summary>
                <ActionForm
                  action={addGuestsToInvitation.bind(null, invitation.id)}
                  submitLabel="Add selected guests"
                  className="mt-3 space-y-3"
                >
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {candidates.map((g) => (
                      <CheckboxField key={g.id} name="guest_id" value={g.id} label={fullName(g)} />
                    ))}
                  </div>
                </ActionForm>
              </details>
            )}
          </section>

          <section className={ui.card}>
            <h2 className={`${ui.h2} mb-3`}>Events and RSVP</h2>
            {visibleEvents.length === 0 ? (
              <p className="text-sm text-stone-600">
                None of these guests are invited to any events yet. Assign events from each guest or event page.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th className={ui.th}>Guest</th>
                      {visibleEvents.map((e) => (
                        <th key={e.id} className={ui.th}>
                          {e.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {guests.map((g) => (
                      <tr key={g.id}>
                        <td className={ui.td}>{g.first_name}</td>
                        {visibleEvents.map((e) => (
                          <td key={e.id} className={ui.td}>
                            {!assigned.has(`${g.id}:${e.id}`) ? (
                              <span className="text-stone-400">Not invited</span>
                            ) : !e.rsvp_required ? (
                              <span className="text-stone-500">No RSVP</span>
                            ) : (
                              <>
                                <StatusBadge status={statusOf(g.id, e.id)} />
                                {e.meal_selection_required && statusOf(g.id, e.id) === "attending" && (
                                  <span className="block text-xs text-stone-600">
                                    {mealOf(g.id, e.id) ?? "No meal chosen"}
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {(invitation.guest_message || invitation.contact_email) && (
            <section className={ui.card}>
              <h2 className={`${ui.h2} mb-3`}>From the guests</h2>
              {invitation.guest_message && <p className="whitespace-pre-line">“{invitation.guest_message}”</p>}
              {invitation.contact_email && (
                <p className="mt-2 text-sm text-stone-600">
                  Email for updates:{" "}
                  <a href={`mailto:${invitation.contact_email}`} className={ui.link}>
                    {invitation.contact_email}
                  </a>
                </p>
              )}
            </section>
          )}

          <section className={ui.card}>
            <h2 className={`${ui.h2} mb-3`}>Activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-stone-600">No guest activity yet. (Your own previews are not recorded.)</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex justify-between gap-4">
                    <span>
                      {ACTIVITY_LABELS[a.activity_type] ?? a.activity_type}
                      {a.actor === "admin" && <span className="text-stone-500"> (by admin)</span>}
                    </span>
                    <span className="text-stone-500">{formatTimestamp(a.occurred_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className={ui.card}>
            <h2 className={`${ui.h2} mb-3`}>QR code</h2>
            <div
              className="mx-auto w-56 max-w-full"
              dangerouslySetInnerHTML={{ __html: generateQrSvg(url, `QR code for ${title}`) }}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`/i/${invitation.token}`} target="_blank" rel="noreferrer" className={ui.buttonSecondary}>
                Preview invitation
              </a>
              <a href={url} target="_blank" rel="noreferrer" className={ui.buttonSecondary}>
                Open personalized URL
              </a>
              <a href={`/admin/invitations/${invitation.id}/qr.svg`} className={ui.buttonSecondary}>
                Download SVG
              </a>
              <Link href={`/admin/invitations/${invitation.id}/print`} className={ui.button}>
                Print single invitation
              </Link>
            </div>
            <p className={ui.hint}>
              Previews from this browser are not logged as guest activity. RSVPs you submit while signed in are recorded
              as entered by an admin.
            </p>
          </section>

          <section className={ui.card}>
            <h2 className={`${ui.h2} mb-1`}>QR validation</h2>
            <p className="mb-3 text-sm text-stone-600">
              {validation === "passed" && `Passed ${formatTimestamp(invitation.validated_at)}.`}
              {validation === "failed" && `Failed ${formatTimestamp(invitation.validated_at)}.`}
              {validation === "stale" && "Validated against a different URL. Validate again."}
              {validation === "not_validated" && "Not validated yet (or guests/token changed since)."}
            </p>
            <QrTools action={checkQr.bind(null, invitation.id)} />
            {lastValidation && validation !== "not_validated" && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-stone-700">Last saved result</summary>
                <ValidationChecks result={lastValidation} />
              </details>
            )}
          </section>

          <section className={ui.card}>
            <h2 className={`${ui.h2} mb-3`}>Lifecycle</h2>
            <div className="space-y-4 text-sm">
              {isDraft && (
                <div>
                  <ActionForm
                    action={lockInvitation.bind(null, invitation.id)}
                    submitLabel="Lock invitation"
                    confirm="Lock this invitation? Its link, QR code, and RSVP code become permanent. This cannot be undone."
                  />
                  <p className={ui.hint}>Lock before final printing. Locking is permanent.</p>
                </div>
              )}
              {isDraft && (
                <div>
                  <ActionForm
                    action={regenerateToken.bind(null, invitation.id)}
                    submitLabel="Regenerate link and code"
                    variant="secondary"
                    confirm="Generate a new link, QR code, and RSVP code? The current ones will stop working, and any printed proofs become invalid."
                  />
                  <p className={ui.hint}>Only possible before locking.</p>
                </div>
              )}
              {invitation.status === "void" ? (
                <ActionForm
                  action={restoreInvitation.bind(null, invitation.id)}
                  submitLabel="Restore invitation"
                  variant="secondary"
                />
              ) : (
                <ActionForm
                  action={voidInvitation.bind(null, invitation.id)}
                  submitLabel="Void invitation"
                  variant="danger"
                  confirm="Void this invitation? Its link and RSVP code will stop working until restored."
                />
              )}
              {provisional && invitation.status === "locked" && (
                <p className="text-amber-800">
                  Locked while using a provisional base URL. The token is permanent, so the QR will work on the
                  production domain after you re-validate there.
                </p>
              )}
            </div>
          </section>

          <section className={ui.card}>
            <h2 className={`${ui.h2} mb-4`}>Details</h2>
            <ActionForm action={updateInvitation.bind(null, invitation.id)} submitLabel="Save details">
              <TextField name="label" label="Label" defaultValue={invitation.label} />
              <SelectField
                name="household_id"
                label="Household"
                defaultValue={invitation.household_id}
                emptyLabel="— None —"
                options={(households ?? []).map((h) => ({ value: h.id, label: h.display_name }))}
              />
              <TextAreaField name="notes" label="Private notes" defaultValue={invitation.notes} />
            </ActionForm>
          </section>
        </div>
      </div>
    </div>
  );
}
