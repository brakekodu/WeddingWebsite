import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { StatusBadge } from "@/components/ui/badge";
import { CheckboxField, SelectField, TextField } from "@/components/ui/fields";
import { ui } from "@/components/ui/styles";
import { param } from "@/lib/admin/search";
import { requireAdminPage } from "@/lib/auth/admin";
import { getAppBaseUrl } from "@/lib/env";
import { formatRsvpCode, normalizeRsvpCode } from "@/lib/invitations/credentials";
import { fullName } from "@/lib/invitations/greeting";
import { effectiveValidationStatus } from "@/lib/invitations/validation";
import { createInvitation, validateAllInvitations } from "./actions";

export const metadata = { title: "Invitations" };

export default async function InvitationsPage(props: PageProps<"/admin/invitations">) {
  const { supabase } = await requireAdminPage();
  const baseUrl = getAppBaseUrl();
  const searchParams = await props.searchParams;
  const q = param(searchParams.q).toLowerCase();
  const statusFilter = param(searchParams.status);

  const [{ data: invitations, error }, { data: households }, { data: rsvps }, { data: requiredPairs }] =
    await Promise.all([
      supabase
        .from("invitations")
        .select(
          "id, label, token, rsvp_code, status, print_status, qr_validation_status, validated_url, households(display_name), invitation_guests(guest_id, guests(first_name, last_name))",
        )
        .order("created_at", { ascending: false }),
      supabase.from("households").select("id, display_name").order("display_name"),
      supabase.from("rsvps").select("guest_id, event_id, status"),
      supabase.from("guest_events").select("guest_id, event_id, events(rsvp_required)"),
    ]);
  if (error) throw new Error(error.message);

  const answered = new Set(
    (rsvps ?? []).filter((r) => r.status !== "pending").map((r) => `${r.guest_id}:${r.event_id}`),
  );
  const pairsByGuest = new Map<string, string[]>();
  for (const p of requiredPairs ?? []) {
    if (!p.events?.rsvp_required) continue;
    pairsByGuest.set(p.guest_id, [...(pairsByGuest.get(p.guest_id) ?? []), p.event_id]);
  }
  const responseState = (guestIds: string[]) => {
    const pairs = guestIds.flatMap((g) => (pairsByGuest.get(g) ?? []).map((e) => `${g}:${e}`));
    if (pairs.length === 0) return "No RSVP events";
    const done = pairs.filter((p) => answered.has(p)).length;
    return done === pairs.length ? "Responded" : done === 0 ? "Awaiting reply" : "Partial";
  };

  const rows = invitations
    .map((inv) => ({
      ...inv,
      validation: effectiveValidationStatus(inv, baseUrl),
      names: inv.invitation_guests.flatMap((ig) => (ig.guests ? [fullName(ig.guests)] : [])),
    }))
    .filter((inv) => {
      if (statusFilter === "failed" && inv.validation !== "failed") return false;
      if (statusFilter === "unvalidated" && inv.validation === "passed") return false;
      if (["draft", "locked", "void"].includes(statusFilter) && inv.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [inv.label, inv.households?.display_name, ...inv.names].join(" ").toLowerCase();
      return haystack.includes(q) || normalizeRsvpCode(inv.rsvp_code) === normalizeRsvpCode(q);
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={ui.h1}>Invitations</h1>
          <p className="text-sm text-stone-600">Each invitation has its own link, QR code, and RSVP code.</p>
        </div>
        <form className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={param(searchParams.q)}
            placeholder="Name or RSVP code"
            className={`${ui.input} w-48`}
          />
          <select name="status" defaultValue={statusFilter} className={`${ui.input} w-44`}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="locked">Locked</option>
            <option value="void">Void</option>
            <option value="failed">QR failed</option>
            <option value="unvalidated">QR not validated</option>
          </select>
          <button className={ui.buttonSecondary}>Filter</button>
        </form>
      </div>

      <div className={`${ui.card} overflow-x-auto p-0 sm:p-0`}>
        <table className={ui.table}>
          <thead className="bg-stone-50">
            <tr>
              <th className={ui.th}>Invitation</th>
              <th className={ui.th}>Guests</th>
              <th className={ui.th}>Code</th>
              <th className={ui.th}>Status</th>
              <th className={ui.th}>RSVP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((inv) => (
              <tr key={inv.id}>
                <td className={ui.td}>
                  <Link href={`/admin/invitations/${inv.id}`} className={ui.link}>
                    {inv.label ?? inv.households?.display_name ?? "Untitled invitation"}
                  </Link>
                </td>
                <td className={ui.td}>{inv.names.join(", ") || <span className="text-amber-700">No guests</span>}</td>
                <td className={`${ui.td} font-mono`}>{formatRsvpCode(inv.rsvp_code)}</td>
                <td className={`${ui.td} space-y-1 space-x-1`}>
                  <StatusBadge status={inv.status} />
                  <StatusBadge status={inv.validation} />
                  <StatusBadge status={inv.print_status} />
                </td>
                <td className={ui.td}>{responseState(inv.invitation_guests.map((ig) => ig.guest_id))}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className={ui.td} colSpan={5}>
                  No invitations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-4`}>New invitation</h2>
          <ActionForm action={createInvitation} submitLabel="Create invitation">
            <TextField name="label" label="Label" placeholder="Smith Household" hint="For your reference only." />
            <SelectField
              name="household_id"
              label="Household (optional)"
              emptyLabel="— None —"
              options={(households ?? []).map((h) => ({ value: h.id, label: h.display_name }))}
            />
            <CheckboxField
              name="include_household_guests"
              label="Add all of the household's guests"
              defaultChecked
              hint="You can add or remove guests on the next page."
            />
          </ActionForm>
          <p className={ui.hint}>A secure link, QR code, and RSVP code are generated automatically.</p>
        </section>

        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-1`}>Validate all QR codes</h2>
          <p className="mb-4 text-sm text-stone-600">
            Re-checks every active invitation against <span className="font-mono">{baseUrl}</span>. Run this before any
            printing, and again after changing the domain.
          </p>
          <ActionForm
            action={validateAllInvitations}
            submitLabel="Validate all"
            pendingLabel="Validating…"
            variant="secondary"
          />
        </section>
      </div>
    </div>
  );
}
