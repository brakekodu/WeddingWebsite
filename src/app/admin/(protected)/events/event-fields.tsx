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
          { value: "invited_only", label: "Invite-only — only invited guests see it" },
          { value: "public", label: "Public — on the website schedule for everyone" },
          { value: "draft", label: "Draft — hidden from everyone" },
        ]}
        hint="Guests are only ever asked to RSVP for events they are assigned to."
      />
      <TextField name="location_name" label="Location name" defaultValue={event?.location_name} />
      <TextField name="location_address" label="Location address" defaultValue={event?.location_address} />
      <TextAreaField
        name="description"
        label="Description for guests"
        defaultValue={event?.description}
        className="sm:col-span-2"
      />
      <TextField name="attire" label="Attire" defaultValue={event?.attire} placeholder="Garden formal" />
      <TextAreaField
        name="guest_notes"
        label="Notes for guests"
        defaultValue={event?.guest_notes}
        hint="e.g. Please arrive by 4:15 PM · Shuttle from the hotel at 3:45 PM"
        maxLength={1000}
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
