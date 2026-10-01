import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { ui } from "@/components/ui/styles";
import { param } from "@/lib/admin/search";
import { requireAdminPage } from "@/lib/auth/admin";
import { formatRsvpCode } from "@/lib/invitations/credentials";
import { fullName } from "@/lib/invitations/greeting";
import { createGuest } from "./actions";
import { GuestFields } from "./guest-fields";

export const metadata = { title: "Guests" };

export default async function GuestsPage(props: PageProps<"/admin/guests">) {
  const { supabase } = await requireAdminPage();
  const searchParams = await props.searchParams;
  // Characters that are syntax in PostgREST filters are dropped from free-text search.
  const q = param(searchParams.q)
    .replace(/[,()"\\%_*]/g, " ")
    .trim();
  const household = param(searchParams.household);

  let query = supabase
    .from("guests")
    .select(
      "id, first_name, last_name, display_name, email, household_id, households(display_name), guest_events(event_id), invitation_guests(invitation_id, invitations(rsvp_code, status))",
    )
    .order("last_name", { nullsFirst: false })
    .order("first_name");
  if (q)
    query = query.or(`first_name.ilike.*${q}*,last_name.ilike.*${q}*,display_name.ilike.*${q}*,email.ilike.*${q}*`);
  if (household === "none") query = query.is("household_id", null);
  else if (/^[0-9a-f-]{36}$/i.test(household)) query = query.eq("household_id", household);

  const [{ data: guests, error }, { data: households }, { data: events }] = await Promise.all([
    query,
    supabase.from("households").select("id, display_name").order("display_name"),
    supabase.from("events").select("id, name").order("display_order"),
  ]);
  if (error) throw new Error(error.message);
  const eventName = new Map((events ?? []).map((e) => [e.id, e.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className={ui.h1}>Guests</h1>
        <form className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={param(searchParams.q)}
            placeholder="Search name or email"
            className={`${ui.input} w-56`}
          />
          <select name="household" defaultValue={household} className={`${ui.input} w-48`}>
            <option value="">All households</option>
            <option value="none">No household</option>
            {(households ?? []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.display_name}
              </option>
            ))}
          </select>
          <button className={ui.buttonSecondary}>Filter</button>
        </form>
      </div>

      <div className={`${ui.card} overflow-x-auto p-0 sm:p-0`}>
        <table className={ui.table}>
          <thead className="bg-stone-50">
            <tr>
              <th className={ui.th}>Guest</th>
              <th className={ui.th}>Household</th>
              <th className={ui.th}>Events</th>
              <th className={ui.th}>Invitation</th>
              <th className={ui.th}>Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {guests.map((g) => {
              const activeInvitations = g.invitation_guests.filter((ig) => ig.invitations?.status !== "void");
              return (
                <tr key={g.id}>
                  <td className={ui.td}>
                    <Link href={`/admin/guests/${g.id}`} className={ui.link}>
                      {fullName(g)}
                    </Link>
                    {g.display_name && <span className="text-stone-500"> ({g.display_name})</span>}
                  </td>
                  <td className={ui.td}>
                    {g.households?.display_name ?? <span className="text-amber-700">None</span>}
                  </td>
                  <td className={ui.td}>
                    {g.guest_events.length === 0 ? (
                      <span className="text-amber-700">None</span>
                    ) : (
                      g.guest_events.map((ge) => eventName.get(ge.event_id)).join(", ")
                    )}
                  </td>
                  <td className={ui.td}>
                    {activeInvitations.length === 0 ? (
                      <span className="text-amber-700">None</span>
                    ) : (
                      activeInvitations.map((ig) => (
                        <Link
                          key={ig.invitation_id}
                          href={`/admin/invitations/${ig.invitation_id}`}
                          className={`${ui.link} mr-2`}
                        >
                          {formatRsvpCode(ig.invitations?.rsvp_code ?? "")}
                        </Link>
                      ))
                    )}
                    {activeInvitations.length > 1 && <span className="text-amber-700"> (multiple)</span>}
                  </td>
                  <td className={ui.td}>{g.email ?? "—"}</td>
                </tr>
              );
            })}
            {guests.length === 0 && (
              <tr>
                <td className={ui.td} colSpan={5}>
                  No guests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-4`}>New guest</h2>
        <ActionForm action={createGuest} submitLabel="Add guest" resetOnSuccess>
          <GuestFields households={households ?? []} />
        </ActionForm>
      </section>
    </div>
  );
}
