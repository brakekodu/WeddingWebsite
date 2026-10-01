import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { StatusBadge } from "@/components/ui/badge";
import { TextField } from "@/components/ui/fields";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { formatRsvpCode } from "@/lib/invitations/credentials";
import { fullName } from "@/lib/invitations/greeting";
import { addGuestToHousehold, createInvitationForHousehold, deleteHousehold, updateHousehold } from "../actions";
import { HouseholdFields } from "../household-fields";

export const metadata = { title: "Household" };

export default async function HouseholdPage(props: PageProps<"/admin/households/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdminPage();

  const { data: household } = await supabase
    .from("households")
    .select("*, guests(id, first_name, last_name, email), invitations(id, label, rsvp_code, status)")
    .eq("id", id)
    .maybeSingle();
  if (!household) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/households" className="text-sm text-stone-600 hover:underline">
          ← Households
        </Link>
        <h1 className={ui.h1}>{household.display_name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-3`}>Guests in this household</h2>
          {household.guests.length === 0 ? (
            <p className="text-sm text-stone-600">No guests yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {household.guests.map((g) => (
                <li key={g.id} className="flex justify-between py-2 text-sm">
                  <Link href={`/admin/guests/${g.id}`} className={ui.link}>
                    {fullName(g)}
                  </Link>
                  <span className="text-stone-500">{g.email ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-6 mb-2 text-sm font-semibold text-stone-800">Add a guest</h3>
          <ActionForm action={addGuestToHousehold.bind(null, household.id)} submitLabel="Add guest" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField name="first_name" label="First name" required maxLength={100} />
              <TextField name="last_name" label="Last name" maxLength={100} />
              <TextField name="email" label="Email" type="email" />
            </div>
          </ActionForm>
        </section>

        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-3`}>Invitations</h2>
          {household.invitations.length === 0 ? (
            <p className="text-sm text-stone-600">No invitations yet.</p>
          ) : (
            <ul className="mb-4 divide-y divide-stone-100">
              {household.invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/admin/invitations/${inv.id}`} className={ui.link}>
                    {inv.label ?? "Invitation"} · {formatRsvpCode(inv.rsvp_code)}
                  </Link>
                  <StatusBadge status={inv.status} />
                </li>
              ))}
            </ul>
          )}
          <ActionForm
            action={createInvitationForHousehold.bind(null, household.id)}
            submitLabel="Create invitation for all household guests"
            pendingLabel="Creating…"
            variant="secondary"
          />
          <p className={ui.hint}>
            You can also create an invitation with any combination of guests from the Invitations page.
          </p>
        </section>
      </div>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-4`}>Household details</h2>
        <ActionForm action={updateHousehold.bind(null, household.id)} submitLabel="Save household">
          <HouseholdFields household={household} />
        </ActionForm>
      </section>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-2`}>Delete household</h2>
        <p className="mb-3 text-sm text-stone-600">Only possible once it has no guests.</p>
        <ActionForm
          action={deleteHousehold.bind(null, household.id)}
          submitLabel="Delete household"
          variant="danger"
          confirm={`Delete ${household.display_name}? This cannot be undone.`}
        />
      </section>
    </div>
  );
}
