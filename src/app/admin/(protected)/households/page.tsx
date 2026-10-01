import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { ui } from "@/components/ui/styles";
import { likePattern, param } from "@/lib/admin/search";
import { requireAdminPage } from "@/lib/auth/admin";
import { createHousehold } from "./actions";
import { HouseholdFields } from "./household-fields";

export const metadata = { title: "Households" };

export default async function HouseholdsPage(props: PageProps<"/admin/households">) {
  const { supabase } = await requireAdminPage();
  const q = param((await props.searchParams).q);

  let query = supabase
    .from("households")
    .select("id, display_name, primary_email, city, guests(count), invitations(count)")
    .order("display_name");
  if (q) query = query.ilike("display_name", likePattern(q));
  const { data: households, error } = await query;
  if (error) throw new Error(error.message);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={ui.h1}>Households</h1>
          <p className="text-sm text-stone-600">
            A household groups guests (for mailing). Invitations are created separately.
          </p>
        </div>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search households" className={ui.input} />
          <button className={ui.buttonSecondary}>Search</button>
        </form>
      </div>

      <div className={`${ui.card} overflow-x-auto p-0 sm:p-0`}>
        <table className={ui.table}>
          <thead className="bg-stone-50">
            <tr>
              <th className={ui.th}>Household</th>
              <th className={ui.th}>Guests</th>
              <th className={ui.th}>Invitations</th>
              <th className={ui.th}>Email</th>
              <th className={ui.th}>City</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {households.map((h) => (
              <tr key={h.id}>
                <td className={ui.td}>
                  <Link href={`/admin/households/${h.id}`} className={ui.link}>
                    {h.display_name}
                  </Link>
                </td>
                <td className={ui.td}>{h.guests[0]?.count ?? 0}</td>
                <td className={ui.td}>{h.invitations[0]?.count ?? 0}</td>
                <td className={ui.td}>{h.primary_email ?? "—"}</td>
                <td className={ui.td}>{h.city ?? "—"}</td>
              </tr>
            ))}
            {households.length === 0 && (
              <tr>
                <td className={ui.td} colSpan={5}>
                  {q ? "No households match your search." : "No households yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-4`}>New household</h2>
        <ActionForm action={createHousehold} submitLabel="Create household">
          <HouseholdFields />
        </ActionForm>
      </section>
    </div>
  );
}
