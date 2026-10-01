import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { portalNav } from "@/components/site/nav";
import {
  Countdown,
  EventCard,
  ExternalLink,
  groupByDay,
  PhotoPlaceholder,
  SectionLabel,
  SiteFooter,
  ViewingAsPill,
} from "@/components/site/parts";
import { SiteHeader } from "@/components/site/site-header";
import { s } from "@/components/site/styles";
import { faqPreview, site } from "@/content/site";
import { formatDateOnly, formatDayHeading, formatShortDate } from "@/lib/format";
import { fetchInvitationView } from "@/lib/invitations/server";
import { invitationNames, lastRespondedAt, portalState } from "@/lib/rsvp/flow";
import { dietarySummary, guestStatuses, mealSummary, personalEvents } from "@/lib/rsvp/portal";
import type { InvitationView } from "@/lib/rsvp/view";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your invitation",
  robots: { index: false, follow: false },
};

const STATUS_TEXT = {
  attending: { symbol: "✓", label: "Attending", className: "text-sage" },
  declined: { symbol: "✕", label: "Not attending", className: "text-muted" },
  pending: { symbol: "○", label: "No response yet", className: "text-muted" },
} as const;

/**
 * The page a guest's QR code opens. One URL whose content depends on state:
 * A welcome (not responded) · B portal (responded) · D closed (after deadline).
 * Resolved only through get_invitation(), which returns this invitation's
 * guests and events and nothing else.
 */
export default async function InvitationPage(props: PageProps<"/i/[token]">) {
  const { token } = await props.params;
  const view = await fetchInvitationView(await createSupabaseServerClient(), token);
  if (!view || view.guests.length === 0) notFound();

  const names = invitationNames(view);
  const state = portalState(view);

  return (
    <>
      <SiteHeader
        monogram={site.couple.monogram}
        items={portalNav(token)}
        homeHref={`/i/${token}`}
        rsvpHref={view.rsvp_open ? `/i/${token}/rsvp${state === "portal" ? "?step=review" : ""}` : `/i/${token}#rsvp`}
        rsvpLabel={state === "portal" && view.rsvp_open ? "Edit RSVP" : "RSVP"}
      />
      <ViewingAsPill names={names} token={token} />
      <main className="flex-1">
        {state === "welcome" ? (
          <Welcome token={token} view={view} names={names} />
        ) : (
          <Portal token={token} view={view} names={names} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

/** State A (screen 03). */
function Welcome({ token, view, names }: { token: string; view: InvitationView; names: string }) {
  const venue = view.events.find((e) => e.rsvp_required)?.location_name ?? "[Venue]";
  const deadline = formatDateOnly(view.rsvp_deadline) ?? "[RSVP deadline]";
  return (
    <section className="bg-lilac px-5 py-12 text-center sm:py-20">
      <div className="mx-auto max-w-lg space-y-5">
        <PhotoPlaceholder label="engagement photo" className="aspect-[4/3]" />
        <SectionLabel>Welcome</SectionLabel>
        <h1 className={s.h1}>{names}</h1>
        <p className="text-lg text-ink">We&apos;re so excited to celebrate with you.</p>
        <div className="space-y-1 text-ink">
          <p>{site.dateLabel}</p>
          <p>
            {venue} · {site.location}
          </p>
        </div>
        <p className="font-semibold">Kindly respond by {deadline}</p>
        <div className="flex flex-col gap-3">
          <Link href={`/i/${token}/rsvp`} className={s.btn}>
            Begin RSVP
          </Link>
          <Link href="/weekend" className={s.btnSecondary}>
            See the wedding weekend
          </Link>
        </div>
        <p className="text-sm text-muted">
          Not {names}?{" "}
          <a href={`mailto:${site.contactEmail}`} className="underline underline-offset-4">
            Let us know
          </a>
        </p>
      </div>
    </section>
  );
}

/** State B (screens 11 & 18), and D when the deadline has passed. */
function Portal({ token, view, names }: { token: string; view: InvitationView; names: string }) {
  const responded = portalState(view) === "portal";
  const deadline = formatDateOnly(view.rsvp_deadline);
  const sent = formatShortDate(lastRespondedAt(view));
  const meals = mealSummary(view);
  const dietary = dietarySummary(view);
  const schedule = personalEvents(view);
  const [hotel] = site.travel.hotels;

  const rsvpCard = (
    <section id="rsvp" aria-labelledby="your-rsvp" className={`${s.card} scroll-mt-24 space-y-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="your-rsvp" className={s.h3}>
          Your RSVP
        </h2>
        {sent && <p className="text-sm text-muted">Sent {sent}</p>}
      </div>
      <ul className="space-y-1">
        {guestStatuses(view).map((g) => {
          const st = STATUS_TEXT[g.status];
          return (
            <li key={g.name} className="flex justify-between gap-3 text-sm">
              <span>{g.name}</span>
              <span className={st.className}>
                <span aria-hidden>{st.symbol} </span>
                {st.label}
              </span>
            </li>
          );
        })}
      </ul>
      {view.rsvp_open ? (
        <>
          <Link href={`/i/${token}/rsvp${responded ? "?step=review" : ""}`} className={`${s.btnSecondary} w-full`}>
            {responded ? "Edit RSVP" : "Begin RSVP"}
          </Link>
          {deadline && <p className="text-xs text-muted">Changes allowed until {deadline}</p>}
        </>
      ) : (
        <p className="text-sm text-muted">
          {responded ? "Need a change?" : "The RSVP deadline has passed."}{" "}
          <a href={`mailto:${site.contactEmail}`} className="underline underline-offset-4">
            Contact us
          </a>
          .
        </p>
      )}
    </section>
  );

  return (
    <div className="px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <Countdown /> <span>{site.dateLabel}</span>
          </div>
          <h1 className={s.h1}>Welcome back, {names}</h1>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="order-2 space-y-12 lg:order-1">
            <section id="weekend" aria-labelledby="your-weekend" className="scroll-mt-24 space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 id="your-weekend" className={s.h2}>
                  Your weekend
                </h2>
                <a href={`/i/${token}/calendar.ics`} className={s.more}>
                  Add all to calendar
                </a>
              </div>
              {groupByDay(schedule.map((p) => ({ ...p, starts_at: p.event.starts_at }))).map((day) => (
                <div key={day.day} className="space-y-3">
                  <p className={s.label}>{formatDayHeading(day.events[0].starts_at)}</p>
                  {day.events.map((p) => (
                    <EventCard
                      key={p.event.id}
                      event={p.event}
                      attending={p.event.rsvp_required ? p.attending : undefined}
                      notAttending={p.event.rsvp_required ? p.notAttending : undefined}
                    />
                  ))}
                </div>
              ))}
            </section>

            <section aria-labelledby="travel" className="space-y-4">
              <h2 id="travel" className={s.h2}>
                Travel &amp; hotel
              </h2>
              <div className="overflow-hidden rounded-xl border border-mist sm:grid sm:grid-cols-[14rem_1fr]">
                <PhotoPlaceholder label="hotel photo" className="h-36 rounded-none border-0 sm:h-full" />
                <div className="space-y-1 p-5">
                  <p className={s.label}>Room block · closes {hotel.until}</p>
                  <p className="font-semibold">{hotel.name}</p>
                  <p className="text-sm text-muted">
                    Code <span className="font-mono">{hotel.code}</span> · {hotel.tag}
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <ExternalLink href={hotel.url} label={`Book your room at ${hotel.name}`} className={s.btnSmall}>
                      Book your room
                    </ExternalLink>
                    <Link href="/travel" className={s.more}>
                      Airports, shuttles &amp; parking ›
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="registry" className="space-y-3">
              <h2 id="registry" className={s.h2}>
                Registry
              </h2>
              <p className="font-serif text-xl">{site.registry.intro}</p>
              <Link href="/registry" className={s.btnSecondary}>
                View registry
              </Link>
            </section>

            <section aria-labelledby="questions" className="space-y-3">
              <h2 id="questions" className={s.h2}>
                Questions
              </h2>
              <FaqAccordion items={faqPreview(3)} />
            </section>
          </div>

          <aside className="order-1 space-y-4 lg:sticky lg:top-24 lg:order-2 lg:self-start">
            {rsvpCard}
            {meals.length > 0 && (
              <section aria-labelledby="your-dinner" className={`${s.card} space-y-2`}>
                <h2 id="your-dinner" className={s.h3}>
                  Your dinner
                </h2>
                <ul className="space-y-1 text-sm">
                  {meals.map((m) => (
                    <li key={`${m.name}-${m.event}`} className="flex justify-between gap-3">
                      <span>{m.name}</span>
                      <span className="text-muted">{m.meal}</span>
                    </li>
                  ))}
                </ul>
                {dietary.length > 0 && (
                  <p className="text-sm text-muted">
                    Dietary: {dietary.map((d) => `${d.name} — ${d.needs}`).join("; ")}
                  </p>
                )}
              </section>
            )}
            <section className={`${s.card} space-y-1 text-sm`}>
              <h2 className={s.h3}>Questions?</h2>
              <p>
                Email{" "}
                <a href={`mailto:${site.contactEmail}`} className="underline underline-offset-4">
                  {site.contactEmail}
                </a>
              </p>
              <p className="text-muted">Wedding-week contact: {site.dayOfContact}</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
