import { ActionForm } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/fields";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { formatDateOnly } from "@/lib/format";
import { updateSettings } from "./actions";

export const metadata = { title: "Settings" };

const ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "Pacific/Honolulu",
];

export default async function SettingsPage() {
  const { supabase } = await requireAdminPage();
  const { data: settings } = await supabase.from("wedding_settings").select("*").eq("id", true).maybeSingle();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className={ui.h1}>Settings</h1>
      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-1`}>RSVP deadline</h2>
        <p className="mb-4 text-sm text-stone-600">
          Guests can respond or change answers through the end of this day (venue time). Afterwards their RSVP is
          read-only with a &ldquo;contact us&rdquo; note; you can still record changes from the admin.
          {settings?.rsvp_deadline && ` Currently: ${formatDateOnly(settings.rsvp_deadline)}.`}
        </p>
        <ActionForm action={updateSettings} submitLabel="Save settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={ui.label}>Last day to RSVP</span>
              <input
                type="date"
                name="rsvp_deadline"
                defaultValue={settings?.rsvp_deadline ?? ""}
                className={ui.input}
              />
              <span className={ui.hint}>Leave empty for no deadline.</span>
            </label>
            <TextField
              name="time_zone"
              label="Venue time zone"
              required
              defaultValue={settings?.time_zone ?? "America/New_York"}
              hint="Decides when the deadline day ends."
            />
          </div>
          <p className="text-xs text-stone-500">Common: {ZONES.join(", ")}</p>
        </ActionForm>
      </section>
      <p className="text-sm text-stone-500">
        Website text (story, travel, registry links, FAQ) lives in <code>src/content/site.ts</code> for now; editing it
        here is planned for the admin redesign.
      </p>
    </div>
  );
}
