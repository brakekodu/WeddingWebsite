import Link from "next/link";
import { EventCard, groupByDay, SectionLabel } from "@/components/site/parts";
import { s } from "@/components/site/styles";
import { site } from "@/content/site";
import { formatDayHeading } from "@/lib/format";
import { personalEvents } from "@/lib/rsvp/portal";
import { getPublicSite, getViewer } from "@/lib/site/server";

export const metadata = { title: "Wedding Weekend" };

/**
 * Wedding Weekend (screen 15). Public events only — or, with an invitation
 * on this device, that invitation's personal schedule (including private events).
 */
export default async function WeekendPage() {
  const [publicSite, viewer] = await Promise.all([getPublicSite(), getViewer()]);
  const personal = viewer ? personalEvents(viewer.view) : null;

  return (
    <>
      <section className="bg-lilac px-5 py-14 text-center sm:py-20">
        <SectionLabel>
          {site.weekendLabel} · {site.location}
        </SectionLabel>
        <h1 className={`${s.h1} mt-3`}>{personal ? "Your wedding weekend" : "The wedding weekend"}</h1>
        {personal ? (
          <p className="mx-auto mt-4 max-w-xl text-muted">
            Only the events you&apos;re invited to, and who&apos;s attending each.
          </p>
        ) : (
          <>
            <p className="mx-auto mt-4 max-w-xl text-muted">{site.weekend.intro}</p>
            <Link href="/rsvp" className={`${s.btnSecondary} mt-6`}>
              Find my invitation
            </Link>
          </>
        )}
      </section>

      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className={`${s.container} space-y-10`}>
          {personal ? (
            groupByDay(personal.map((p) => ({ ...p, starts_at: p.event.starts_at }))).map((day) => (
              <div key={day.day} className="space-y-4">
                <h2 className="font-serif text-2xl">{formatDayHeading(day.events[0].starts_at)}</h2>
                {day.events.map((p) => (
                  <EventCard
                    key={p.event.id}
                    event={p.event}
                    attending={p.attending.length || p.notAttending.length ? p.attending : undefined}
                    notAttending={p.notAttending}
                  />
                ))}
              </div>
            ))
          ) : publicSite.events.length === 0 ? (
            <p className="text-center text-muted">The schedule is coming soon.</p>
          ) : (
            groupByDay(publicSite.events).map((day) => (
              <div key={day.day} className="space-y-4">
                <h2 className="font-serif text-2xl">{formatDayHeading(day.events[0].starts_at)}</h2>
                {day.events.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            ))
          )}
          <p>
            <a href={personal ? `/i/${viewer!.token}/calendar.ics` : "/weekend/calendar.ics"} className={s.more}>
              Add {personal ? "your events" : "these events"} to your calendar
            </a>
          </p>
        </div>
      </section>

      <section className={s.section}>
        <div className={`${s.container} space-y-6`}>
          <h2 className={s.h2}>Good to know</h2>
          <dl className="grid gap-6 md:grid-cols-3">
            {site.weekend.goodToKnow.map((item) => (
              <div key={item.label} className={s.card}>
                <dt className="font-semibold">{item.label}</dt>
                <dd className="mt-1 text-muted">{item.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
