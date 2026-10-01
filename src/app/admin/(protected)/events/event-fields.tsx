import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import { toDateTimeLocalInput } from "@/lib/format";
import type { EventRow } from "@/lib/supabase/database.types";

export function EventFields({ event }: { event?: EventRow }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        name="name"
        label="Event name"
        required
        maxLength={120}
        defaultValue={event?.name}
        placeholder="Ceremony"
      />
      <TextField
        name="display_order"
        label="Display order"
        type="number"
        defaultValue={event?.display_order ?? 0}
        hint="Lower numbers appear first."
      />
      <TextField
        name="starts_at"
        label="Starts"
        type="datetime-local"
        defaultValue={toDateTimeLocalInput(event?.starts_at ?? null)}
        hint="Local time at the venue."
      />
      <TextField
        name="ends_at"
        label="Ends"
        type="datetime-local"
        defaultValue={toDateTimeLocalInput(event?.ends_at ?? null)}
      />
      <TextField
        name="time_zone"
        label="Venue time zone"
        defaultValue={event?.time_zone}
        placeholder="America/New_York"
        hint="IANA name; used later for calendar invites."
      />
      <SelectField
        name="visibility"
        label="Visibility"
        defaultValue={event?.visibility ?? "invited_only"}
        options={[
          { value: "invited_only", label: "Invited guests only" },
          { value: "public", label: "Public schedule (future site) + invited guests" },
        ]}
        hint="Either way, the RSVP page only shows events a guest is assigned to."
      />
      <TextField name="location_name" label="Location name" defaultValue={event?.location_name} />
      <TextField name="location_address" label="Location address" defaultValue={event?.location_address} />
      <TextAreaField
        name="description"
        label="Description for guests"
        defaultValue={event?.description}
        className="sm:col-span-2"
      />
      <CheckboxField
        name="rsvp_required"
        label="Guests must RSVP to this event"
        defaultChecked={event?.rsvp_required ?? true}
      />
      <CheckboxField
        name="meal_selection_required"
        label="Guests choose a meal for this event"
        defaultChecked={event?.meal_selection_required ?? false}
        hint="Add meal options after saving."
      />
    </div>
  );
}
