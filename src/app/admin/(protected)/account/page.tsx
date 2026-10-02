import { ActionForm } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/fields";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { changePassword } from "./actions";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const { email } = await requireAdminPage();
  return (
    <div className="max-w-lg space-y-6">
      <h1 className={ui.h1}>Your account</h1>
      <p className="text-sm text-stone-600">
        Signed in as <strong>{email}</strong>.
      </p>
      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-4`}>Change password</h2>
        <ActionForm action={changePassword} submitLabel="Change password" resetOnSuccess>
          <TextField
            name="password"
            label="New password"
            type="password"
            required
            autoComplete="new-password"
            hint="At least 12 characters."
          />
          <TextField name="confirm" label="Type it again" type="password" required autoComplete="new-password" />
        </ActionForm>
      </section>
    </div>
  );
}
