import Link from "next/link";
import { ui } from "@/components/ui/styles";
import { requireAdminPage } from "@/lib/auth/admin";
import { computeDashboardMetrics } from "@/lib/dashboard/metrics";
import { getAppBaseUrl } from "@/lib/env";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase } = await requireAdminPage();

  const [households, invitations, invitationGuests, guests, events, guestEvents, rsvps, mealSelections, mealOptions] =
    await Promise.all([
      supabase.from("households").select("id", { count: "exact", head: true }),
      supabase.from("invitations").select("id, status, token, qr_validation_status, validated_url"),
      supabase.from("invitation_guests").select("invitation_id, guest_id"),
      supabase.from("guests").select("id, first_name, last_name, dietary_restrictions, dietary_tags"),
      supabase.from("events").select("id, name, rsvp_required, meal_selection_required").order("display_order"),
      supabase.from("guest_events").select("guest_id, event_id"),
      supabase.from("rsvps").select("guest_id, event_id, status"),
      supabase.from("meal_selections").select("guest_id, event_id, meal_option_id"),
      supabase.from("meal_options").select("id, event_id, name, is_active").order("display_order"),
    ]);
  const failed = [
    households,
    invitations,
    invitationGuests,
    guests,
    events,
    guestEvents,
    rsvps,
    mealSelections,
    mealOptions,
  ].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const m = computeDashboardMetrics({
    baseUrl: getAppBaseUrl(),
    householdsCount: households.count ?? 0,
    invitations: invitations.data!,
    invitationGuests: invitationGuests.data!,
    guests: guests.data!,
    events: events.data!,
    guestEvents: guestEvents.data!,
    rsvps: rsvps.data!,
    mealSelections: mealSelections.data!,
    mealOptions: mealOptions.data!,
  });
  const t = m.totals;
  const qrProblems = m.qr.failed + m.qr.stale + m.qr.notValidated;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className={ui.h1}>Dashboard</h1>
        <a href="/admin/export/rsvps.csv" className={ui.buttonSecondary}>
          Download RSVPs (CSV)
        </a>
      </div>

      {/* Hero: the one number this page leads with. */}
      <section className={ui.card} aria-labelledby="responses-heading">
        <h2 id="responses-heading" className="text-sm font-medium text-stone-600">
          Responses received
        </h2>
        <p className="mt-1 text-5xl font-semibold text-stone-900">{t.responsePercent}%</p>
        <p className="mt-1 text-sm text-stone-600">
          {t.responsesReceived} of {t.invitationsAwaitingResponse} invitation
          {t.invitationsAwaitingResponse === 1 ? "" : "s"} have replied
        </p>
        <div
          className="mt-4 h-2 w-full overflow-hidden rounded-full bg-emerald-100"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={t.responsePercent}
          aria-label="Response rate"
        >
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${t.responsePercent}%` }} />
        </div>
      </section>

      <section aria-label="Guest totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Guests invited" value={t.guestsInvited} />
        <Stat label="Attending" value={t.attending} />
        <Stat label="Declined" value={t.declined} />
        <Stat label="Still to reply" value={t.outstanding} />
        <Stat label="Households" value={t.households} href="/admin/households" />
        <Stat label="Invitations" value={t.invitations} href="/admin/invitations" />
        <Stat
          label="QR codes needing attention"
          value={qrProblems}
          href={qrProblems ? "/admin/invitations?status=unvalidated" : undefined}
          note={m.qr.failed ? `${m.qr.failed} failed` : undefined}
        />
        <Stat
          label="Guests not on an invitation"
          value={t.guestsWithoutInvitation}
          href={t.guestsWithoutInvitation ? "/admin/guests" : undefined}
        />
      </section>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-3`}>Attendance by event</h2>
        {m.events.length === 0 ? (
          <p className="text-sm text-stone-600">
            No events yet.{" "}
            <Link href="/admin/events" className={ui.link}>
              Create one
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`${ui.table} tabular-nums`}>
              <thead>
                <tr>
                  <th className={ui.th}>Event</th>
                  <th className={`${ui.th} text-right`}>Invited</th>
                  <th className={`${ui.th} text-right`}>Attending</th>
                  <th className={`${ui.th} text-right`}>Declined</th>
                  <th className={`${ui.th} text-right`}>Awaiting reply</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {m.events.map((e) => (
                  <tr key={e.id}>
                    <td className={ui.td}>
                      <Link href={`/admin/events/${e.id}`} className={ui.link}>
                        {e.name}
                      </Link>
                    </td>
                    <td className={`${ui.td} text-right`}>{e.invited}</td>
                    <td className={`${ui.td} text-right font-semibold`}>{e.rsvpRequired ? e.attending : "—"}</td>
                    <td className={`${ui.td} text-right`}>{e.rsvpRequired ? e.declined : "—"}</td>
                    <td className={`${ui.td} text-right`}>{e.rsvpRequired ? e.pending : "No RSVP"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-3`}>Meal counts</h2>
          {m.events.filter((e) => e.mealRequired).length === 0 ? (
            <p className="text-sm text-stone-600">No events collect meal choices.</p>
          ) : (
            m.events
              .filter((e) => e.mealRequired)
              .map((e) => (
                <div key={e.id} className="mb-4 last:mb-0">
                  <h3 className="text-sm font-semibold text-stone-800">{e.name}</h3>
                  <table className={`${ui.table} tabular-nums`}>
                    <tbody className="divide-y divide-stone-100">
                      {e.meals.map((meal) => (
                        <tr key={meal.id}>
                          <td className={ui.td}>
                            {meal.name}
                            {!meal.active && <span className="text-stone-500"> (hidden)</span>}
                          </td>
                          <td className={`${ui.td} text-right font-semibold`}>{meal.count}</td>
                        </tr>
                      ))}
                      {e.missingMeals > 0 && (
                        <tr>
                          <td className={`${ui.td} text-amber-800`}>Attending, no meal chosen</td>
                          <td className={`${ui.td} text-right font-semibold text-amber-800`}>{e.missingMeals}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ))
          )}
          {m.missingMeals.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-amber-800">Who still needs to choose a meal</summary>
              <ul className="mt-1 list-disc pl-5 text-stone-700">
                {m.missingMeals.map((x) => (
                  <li key={`${x.guestName}-${x.eventName}`}>
                    {x.guestName} — {x.eventName}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className={ui.card}>
          <h2 className={`${ui.h2} mb-3`}>Dietary restrictions</h2>
          {m.dietary.length === 0 ? (
            <p className="text-sm text-stone-600">None reported by attending guests yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {m.dietary.map((d) => (
                <li key={d.guestName} className="py-2">
                  <span className="font-medium text-stone-900">{d.guestName}</span>
                  <span className="block text-stone-700">{d.restrictions}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={ui.card}>
        <h2 className={`${ui.h2} mb-3`}>QR code status</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums sm:grid-cols-4">
          <QrStat label="Valid" value={m.qr.passed} />
          <QrStat label="Failed" value={m.qr.failed} />
          <QrStat label="Needs revalidation" value={m.qr.stale} />
          <QrStat label="Not validated" value={m.qr.notValidated} />
        </dl>
        {qrProblems > 0 && (
          <p className="mt-3 text-sm text-stone-600">
            Run{" "}
            <Link href="/admin/invitations" className={ui.link}>
              Validate all
            </Link>{" "}
            before printing.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, href, note }: { label: string; value: number; href?: string; note?: string }) {
  const body = (
    <>
      <p className="text-sm text-stone-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-stone-900">{value}</p>
      {note && <p className="text-xs text-stone-500">{note}</p>}
    </>
  );
  return href ? (
    <Link href={href} className={`${ui.card} block p-4 hover:border-stone-400 sm:p-4`}>
      {body}
    </Link>
  ) : (
    <div className={`${ui.card} p-4 sm:p-4`}>{body}</div>
  );
}

function QrStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-stone-50 p-3">
      <dt className="text-stone-600">{label}</dt>
      <dd className="text-xl font-semibold text-stone-900">{value}</dd>
    </div>
  );
}
