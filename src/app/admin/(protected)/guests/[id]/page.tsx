import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { StatusBadge } from "@/components/ui/badge";
import { CheckboxField } from "@/components/ui/fields";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { formatEventDate } from "@/lib/format";
import { formatRsvpCode } from "@/lib/invitations/credentials";
import { fullName } from "@/lib/invitations/greeting";
import { deleteGuest, setGuestEvents, updateGuest } from "../actions";
import { GuestFields } from "../guest-fields";

export const metadata = { title: "Guest" };

export default async function GuestPage(props: PageProps<"/admin/guests/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdminPage();

  const { data: guest } = await supabase
    .from("guests")
    .select("*, invitation_guests(invitation_id, invitations(label, rsvp_code, status))")
    .eq("id", id)
    .maybeSingle();
  if (!guest) notFound();

  const [
    { data: households },
    { data: events },
    { data: assignments },
    { data: rsvps },
    { data: meals },
    { data: others },
  ] = await Promise.all([
    supabase.from("households").select("id, display_name").order("display_name"),
    supabase
      .from("events")
      .select("id, name, starts_at, rsvp_required, meal_selection_required")
      .order("display_order"),
    supabase.from("guest_events").select("event_id").eq("guest_id", id),
    supabase.from("rsvps").select("event_id, status, updated_at").eq("guest_id", id),
    supabase.from("meal_selections").select("event_id, meal_options(name)").eq("guest_id", id),
    supabase.from("guests").select("id, first_name, last_name").neq("id", id).order("last_name"),
  ]);

  const assigned = new Set((assignments ?? []).map((a) => a.event_id));
  const rsvpByEvent = new Map((rsvps ?? []).map((r) => [r.event_id, r]));
  const mealByEvent = new Map((meals ?? []).map((m) => [m.event_id, m.meal_options?.name]));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/guests" className="text-sm text-stone-600 hover:underline">
          ← Guests
        </Link>
        <h1 className={ui.h1}>{fullName(guest)}</h1>
        {guest.household_id && (
          <Link href={`/admin/households/${guest.household_id}`} className="text-sm text-stone-600 hover:underline">
            View household
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-1`}>Invited to events</h2>
          <p className="mb-4 text-sm text-stone-600">
            Guests only ever see events checked here. Unchecking an event also removes this guest&apos;s RSVP for it.
          </p>
          {(events ?? []).length === 0 ? (
            <p className="text-sm text-stone-600">
              No events yet.{" "}
              <Link href="/admin/events" className={ui.link}>
                Create events
              </Link>{" "}
              first.
            </p>
          ) : (
            <ActionForm action={setGuestEvents.bind(null, guest.id)} submitLabel="Save events">
              <div className="space-y-2">
                {(events ?? []).map((e) => (
                  <CheckboxField
                    key={e.id}
                    name="event_id"
                    value={e.id}
                    label={e.name}
                    hint={formatEventDate(e.starts_at) ?? undefined}
                    defaultChecked={assigned.has(e.id)}
                  />
                ))}
              </div>
            </ActionForm>
          )}
        </section>

        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-3`}>RSVP</h2>
          {assigned.size === 0 ? (
            <p className="text-sm text-stone-600">Not invited to any events yet.</p>
          ) : (
            <table className={ui.table}>
              <tbody className="divide-y divide-stone-100">
                {(events ?? [])
                  .filter((e) => assigned.has(e.id))
                  .map((e) => (
                    <tr key={e.id}>
                      <td className={ui.td}>{e.name}</td>
                      <td className={ui.td}>
                        {e.rsvp_required ? (
                          <StatusBadge status={rsvpByEvent.get(e.id)?.status ?? "pending"} />
                        ) : (
                          <span className="text-stone-500">No RSVP needed</span>
                        )}
                      </td>
                      <td className={ui.td}>{e.meal_selection_required ? (mealByEvent.get(e.id) ?? "—") : ""}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          <h3 className="mt-6 mb-2 text-sm font-semibold text-stone-800">Invitations</h3>
          {guest.invitation_guests.length === 0 ? (
            <p className="text-sm text-amber-700">Not on any invitation yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {guest.invitation_guests.map((ig) => (
                <li key={ig.invitation_id} className="flex items-center gap-2">
                  <Link href={`/admin/invitations/${ig.invitation_id}`} className={ui.link}>
                    {ig.invitations?.label ?? "Invitation"} · {formatRsvpCode(ig.invitations?.rsvp_code ?? "")}
                  </Link>
                  {ig.invitations && <StatusBadge status={ig.invitations.status} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-4`}>Guest details</h2>
        <ActionForm action={updateGuest.bind(null, guest.id)} submitLabel="Save guest">
          <GuestFields
            guest={guest}
            households={households ?? []}
            plusOneCandidates={(others ?? []).map((o) => ({ id: o.id, name: fullName(o) }))}
          />
        </ActionForm>
      </section>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-2`}>Delete guest</h2>
        <p className="mb-3 text-sm text-stone-600">Removes the guest from invitations and deletes their RSVPs.</p>
        <ActionForm
          action={deleteGuest.bind(null, guest.id)}
          submitLabel="Delete guest"
          variant="danger"
          confirm={`Delete ${fullName(guest)} and their RSVPs? This cannot be undone.`}
        />
      </section>
    </div>
  );
}
