import { ActionForm } from "@/components/ui/action-form";
import { PasswordInput } from "@/components/ui/password-input";
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
          <label className="block">
            <span className={ui.label}>New password</span>
            <PasswordInput name="password" autoComplete="new-password" className={ui.input} />
            <span className={ui.hint}>At least 12 characters.</span>
          </label>
          <label className="block">
            <span className={ui.label}>Type it again</span>
            <PasswordInput name="confirm" autoComplete="new-password" className={ui.input} />
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
