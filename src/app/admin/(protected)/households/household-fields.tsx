import { TextAreaField, TextField } from "@/components/ui/fields";
import type { HouseholdRow } from "@/lib/supabase/database.types";

export function HouseholdFields({ household }: { household?: HouseholdRow }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        name="display_name"
        label="Household name"
        required
        defaultValue={household?.display_name}
        placeholder="Smith Household"
        className="sm:col-span-2"
      />
      <TextField name="primary_email" label="Email" type="email" defaultValue={household?.primary_email} />
      <TextField name="primary_phone" label="Phone" type="tel" defaultValue={household?.primary_phone} />
      <TextField name="address_line1" label="Address line 1" defaultValue={household?.address_line1} />
      <TextField name="address_line2" label="Address line 2" defaultValue={household?.address_line2} />
      <TextField name="city" label="City" defaultValue={household?.city} />
      <TextField name="region" label="State / region" defaultValue={household?.region} />
      <TextField name="postal_code" label="Postal code" defaultValue={household?.postal_code} />
      <TextField name="country" label="Country" defaultValue={household?.country} />
      <TextAreaField name="notes" label="Private notes" defaultValue={household?.notes} className="sm:col-span-2" />
    </div>
  );
}
