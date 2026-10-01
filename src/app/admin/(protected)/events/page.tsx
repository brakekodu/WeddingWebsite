import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { formatEventDate, formatEventTimeRange } from "@/lib/format";
import { createEvent } from "./actions";
import { EventFields } from "./event-fields";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  const { supabase } = await requireAdminPage();
  const { data: events, error } = await supabase
    .from("events")
    .select("*, guest_events(count), meal_options(count)")
    .order("display_order")
    .order("starts_at", { nullsFirst: false });
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ui.h1}>Events</h1>
        <p className="text-sm text-stone-600">
          Events are fully configurable. Each guest sees only the events they are assigned to.
        </p>
      </div>

      <div className={`${ui.card} overflow-x-auto p-0 sm:p-0`}>
        <table className={ui.table}>
          <thead className="bg-stone-50">
            <tr>
              <th className={ui.th}>#</th>
              <th className={ui.th}>Event</th>
              <th className={ui.th}>When</th>
              <th className={ui.th}>Invited</th>
              <th className={ui.th}>Options</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {events.map((e) => (
              <tr key={e.id}>
                <td className={ui.td}>{e.display_order}</td>
                <td className={ui.td}>
                  <Link href={`/admin/events/${e.id}`} className={ui.link}>
                    {e.name}
                  </Link>
                  {e.location_name && <span className="block text-xs text-stone-500">{e.location_name}</span>}
                </td>
                <td className={ui.td}>
                  {formatEventDate(e.starts_at) ?? "—"}
                  <span className="block text-xs text-stone-500">{formatEventTimeRange(e.starts_at, e.ends_at)}</span>
                </td>
                <td className={ui.td}>{e.guest_events[0]?.count ?? 0}</td>
                <td className={`${ui.td} space-x-1`}>
                  {e.rsvp_required ? <Badge tone="info">RSVP</Badge> : <Badge>No RSVP</Badge>}
                  {e.meal_selection_required && <Badge tone="info">Meals ({e.meal_options[0]?.count ?? 0})</Badge>}
                  {e.visibility === "public" && <Badge>Public</Badge>}
                  {e.visibility === "draft" && <Badge tone="warn">Draft</Badge>}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td className={ui.td} colSpan={5}>
                  No events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-4`}>New event</h2>
        <ActionForm action={createEvent} submitLabel="Create event">
          <EventFields />
        </ActionForm>
      </section>
    </div>
  );
}
