import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/ui/fields";
import type { GuestRow } from "@/lib/supabase/database.types";

export function GuestFields({
  guest,
  households,
  plusOneCandidates = [],
}: {
  guest?: GuestRow;
  households: { id: string; display_name: string }[];
  plusOneCandidates?: { id: string; name: string }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField name="first_name" label="First name" required maxLength={100} defaultValue={guest?.first_name} />
      <TextField name="last_name" label="Last name" maxLength={100} defaultValue={guest?.last_name} />
      <TextField
        name="display_name"
        label="Preferred name"
        maxLength={100}
        defaultValue={guest?.display_name}
        hint="Used in greetings, e.g. “Johnny”. Leave blank to use the first name."
      />
      <SelectField
        name="household_id"
        label="Household"
        defaultValue={guest?.household_id}
        emptyLabel="— No household —"
        options={households.map((h) => ({ value: h.id, label: h.display_name }))}
      />
      <TextField name="email" label="Email" type="email" defaultValue={guest?.email} />
      <TextField name="phone" label="Phone" type="tel" defaultValue={guest?.phone} />
      {guest && (
        <>
          <CheckboxField
            name="plus_one_allowed"
            label="May bring a plus-one"
            defaultChecked={guest.plus_one_allowed}
            className="sm:pt-6"
          />
          <SelectField
            name="plus_one_of"
            label="This guest is the plus-one of"
            defaultValue={guest.plus_one_of}
            emptyLabel="— Not a plus-one —"
            options={plusOneCandidates.map((c) => ({ value: c.id, label: c.name }))}
          />
        </>
      )}
      <TextAreaField
        name="dietary_restrictions"
        label="Dietary restrictions"
        maxLength={500}
        defaultValue={guest?.dietary_restrictions}
        hint="Guests can also update this when they RSVP."
        className="sm:col-span-2"
      />
      <TextAreaField name="notes" label="Private notes" defaultValue={guest?.notes} className="sm:col-span-2" />
    </div>
  );
}
