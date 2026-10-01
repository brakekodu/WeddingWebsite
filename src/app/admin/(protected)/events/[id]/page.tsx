import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { CheckboxField, TextField } from "@/components/ui/fields";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { fullName } from "@/lib/invitations/greeting";
import {
  addMealOption,
  deleteEvent,
  deleteMealOption,
  setEventGuests,
  setMealOptionActive,
  updateEvent,
} from "../actions";
import { EventFields } from "../event-fields";

export const metadata = { title: "Event" };

export default async function EventPage(props: PageProps<"/admin/events/[id]">) {
  const { id } = await props.params;
  const { supabase } = await requireAdminPage();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();

  const [{ data: options }, { data: guests }, { data: assignments }, { data: rsvps }, { data: selections }] =
    await Promise.all([
      supabase.from("meal_options").select("*").eq("event_id", id).order("display_order").order("name"),
      supabase
        .from("guests")
        .select("id, first_name, last_name, households(display_name)")
        .order("last_name", { nullsFirst: false })
        .order("first_name"),
      supabase.from("guest_events").select("guest_id").eq("event_id", id),
      supabase.from("rsvps").select("guest_id, status").eq("event_id", id),
      supabase.from("meal_selections").select("meal_option_id").eq("event_id", id),
    ]);

  const assigned = new Set((assignments ?? []).map((a) => a.guest_id));
  const statusByGuest = new Map((rsvps ?? []).map((r) => [r.guest_id, r.status]));
  const mealCounts = new Map<string, number>();
  for (const s of selections ?? []) mealCounts.set(s.meal_option_id, (mealCounts.get(s.meal_option_id) ?? 0) + 1);

  // Group the guest checklist by household for faster assignment.
  const groups = new Map<string, NonNullable<typeof guests>>();
  for (const g of guests ?? []) {
    const key = g.households?.display_name ?? "No household";
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/events" className="text-sm text-stone-600 hover:underline">
          ← Events
        </Link>
        <h1 className={ui.h1}>{event.name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-1`}>Invited guests ({assigned.size})</h2>
          <p className="mb-4 text-sm text-stone-600">
            Only checked guests will see this event. Unchecking a guest also removes their RSVP for it.
          </p>
          {(guests ?? []).length === 0 ? (
            <p className="text-sm text-stone-600">
              No guests yet.{" "}
              <Link href="/admin/guests" className={ui.link}>
                Add guests
              </Link>{" "}
              first.
            </p>
          ) : (
            <ActionForm action={setEventGuests.bind(null, event.id)} submitLabel="Save guest list">
              <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-2">
                {[...groups.entries()].map(([household, members]) => (
                  <fieldset key={household}>
                    <legend className="mb-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                      {household}
                    </legend>
                    <div className="space-y-1">
                      {members.map((g) => (
                        <div key={g.id} className="flex items-center justify-between gap-2">
                          <CheckboxField
                            name="guest_id"
                            value={g.id}
                            label={fullName(g)}
                            defaultChecked={assigned.has(g.id)}
                          />
                          {assigned.has(g.id) && event.rsvp_required && (
                            <StatusBadge status={statusByGuest.get(g.id) ?? "pending"} />
                          )}
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </ActionForm>
          )}
        </section>

        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-1`}>Meal options</h2>
          {!event.meal_selection_required && (
            <p className="mb-3 text-sm text-amber-800">
              Meal selection is off for this event, so guests won&apos;t be asked. Turn it on below to use these
              options.
            </p>
          )}
          <ul className="mb-4 divide-y divide-stone-100">
            {(options ?? []).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{o.name}</span> {!o.is_active && <Badge tone="warn">Hidden</Badge>}
                  <span className="block text-xs text-stone-500">
                    {o.description ? `${o.description} · ` : ""}
                    {mealCounts.get(o.id) ?? 0} selected
                  </span>
                </span>
                <span className="flex gap-2">
                  <ActionForm
                    inline
                    variant="secondary"
                    action={setMealOptionActive.bind(null, o.id, !o.is_active)}
                    submitLabel={o.is_active ? "Hide" : "Offer"}
                  />
                  <ActionForm
                    inline
                    variant="danger"
                    action={deleteMealOption.bind(null, o.id)}
                    submitLabel="Delete"
                    confirm={`Delete meal option "${o.name}"?`}
                  />
                </span>
              </li>
            ))}
            {(options ?? []).length === 0 && <li className="py-2 text-sm text-stone-600">No meal options yet.</li>}
          </ul>
          <ActionForm action={addMealOption.bind(null, event.id)} submitLabel="Add meal option" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-[2fr_3fr_1fr]">
              <TextField name="name" label="Meal name" required maxLength={120} />
              <TextField name="description" label="Description" />
              <TextField name="display_order" label="Order" type="number" defaultValue={(options ?? []).length + 1} />
            </div>
          </ActionForm>
        </section>
      </div>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-4`}>Event details</h2>
        <ActionForm action={updateEvent.bind(null, event.id)} submitLabel="Save event">
          <EventFields event={event} />
        </ActionForm>
      </section>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-2`}>Delete event</h2>
        <p className="mb-3 text-sm text-stone-600">Deletes the event, its meal options, assignments, and RSVPs.</p>
        <ActionForm
          action={deleteEvent.bind(null, event.id)}
          submitLabel="Delete event"
          variant="danger"
          confirm={`Delete ${event.name}, including all RSVPs for it? This cannot be undone.`}
        />
      </section>
    </div>
  );
}
