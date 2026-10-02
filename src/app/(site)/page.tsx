import Link from "next/link";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { Countdown, EventCard, groupByDay, PhotoPlaceholder, SectionLabel } from "@/components/site/parts";
import { SitePhoto } from "@/components/site/photo";
import { s } from "@/components/site/styles";
import { PLACEMENTS } from "@/content/photos";
import { coupleNames, faqPreview, site } from "@/content/site";
import { formatDateOnly, formatDayHeading } from "@/lib/format";
import { getPublicSite, getViewer } from "@/lib/site/server";

/** Home: hero + previews of every page, so most visitors never need the nav (screens 10 & 14). */
export default async function Home() {
  const [publicSite, viewer] = await Promise.all([getPublicSite(), getViewer()]);
  const rsvpHref = viewer ? `/i/${viewer.token}` : "/rsvp";
  const deadline = formatDateOnly(publicSite.rsvp_deadline) ?? "[RSVP deadline]";
  const days = groupByDay(publicSite.events);
  const [hotel] = site.travel.hotels;

  return (
    <>
      <section className="relative isolate flex min-h-[85svh] items-end justify-center overflow-hidden px-5 pt-24 pb-14 text-center sm:min-h-[88vh] sm:pb-20">
        <SitePhoto
          photo={PLACEMENTS.homeHero}
          sizes="100vw"
          priority
          className="absolute inset-0 -z-20 h-full w-full"
        />
        {/* Darken toward the text so it stays readable over any part of the photo. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-t from-plum-deep/90 via-plum-deep/40 to-plum-deep/5"
        />
        <div className="text-white">
          <h1 className="font-serif text-5xl leading-tight drop-shadow-sm sm:text-7xl">
            {site.couple.first} &amp; {site.couple.second}
          </h1>
          <p className="mt-4 text-lg">
            {site.dateLabel} · {site.location}
          </p>
          <Countdown className="mt-5" />
          <div className="mt-8">
            <Link href={rsvpHref} className={`${s.btn} w-full max-w-xs`}>
              RSVP
            </Link>
          </div>
        </div>
      </section>

      <section className={`${s.section} text-center`}>
        <SectionLabel>Welcome</SectionLabel>
        <p className="mx-auto mt-4 max-w-2xl font-serif text-2xl leading-relaxed text-ink">{site.home.welcome}</p>
      </section>

      <section className={s.section}>
        <div className={`${s.container} grid items-center gap-8 md:grid-cols-2`}>
          <SitePhoto
            photo={PLACEMENTS.homeStory}
            sizes="(min-width: 768px) 480px, 100vw"
            className="aspect-[4/5] w-full rounded-xl"
          />
          <div className="space-y-3">
            <SectionLabel>Our story</SectionLabel>
            <h2 className={s.h2}>{site.story.title}</h2>
            <p className={s.body}>{site.story.teaser}</p>
            <Link href="/story" className={s.more}>
              Read our story &amp; meet the wedding party ›
            </Link>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={`${s.container} space-y-5`}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <SectionLabel>The wedding weekend</SectionLabel>
              <h2 className={`${s.h2} mt-2`}>Join us</h2>
            </div>
            <Link href="/weekend" className={s.more}>
              Full weekend ›
            </Link>
          </div>
          {days.length === 0 ? (
            <p className={s.muted}>The schedule is coming soon.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {days.map((d) => (
                <div key={d.day} className="space-y-3">
                  <p className={s.label}>{formatDayHeading(d.events[0].starts_at)}</p>
                  {d.events.map((e) => (
                    <EventCard key={e.id} event={e} compact />
                  ))}
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-muted">Invited to more events? Your full schedule is on your invitation link.</p>
        </div>
      </section>

      <section className={s.section}>
        <div className={`${s.container} space-y-5`}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <SectionLabel>Travel &amp; stay</SectionLabel>
              <h2 className={`${s.h2} mt-2`}>Getting here</h2>
            </div>
            <Link href="/travel" className={s.more}>
              Travel &amp; Stay ›
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="overflow-hidden rounded-xl border border-mist">
              <PhotoPlaceholder label="hotel photo" className="h-32 rounded-none border-0 border-b" />
              <div className="p-4">
                <p className="font-semibold">Where to stay</p>
                <p className="text-sm text-muted">
                  {hotel.name} room block until {hotel.until}
                </p>
              </div>
            </div>
            <div className={s.card}>
              <p className="font-semibold">Fly in</p>
              {site.travel.airports.map((a) => (
                <p key={a.name} className="text-sm text-muted">
                  {a.name} · {a.note}
                </p>
              ))}
            </div>
            <div className={s.card}>
              <p className="font-semibold">Getting around</p>
              <p className="text-sm text-muted">
                Shuttles between {site.travel.shuttles[0]?.from} and {site.travel.shuttles[0]?.to} · rideshare &amp;
                parking
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={`${s.container} space-y-5`}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <SectionLabel>Gallery</SectionLabel>
            <Link href="/gallery" className={s.more}>
              View gallery ›
            </Link>
          </div>
          <div className="flex snap-x gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible">
            {PLACEMENTS.homeStrip.map((p) => (
              <SitePhoto
                key={p.id}
                photo={p}
                sizes="(min-width: 768px) 25vw, 224px"
                className="aspect-[3/4] w-56 shrink-0 snap-start rounded-lg md:w-auto"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-mist bg-cream px-5 py-16 text-center sm:py-20">
        <SectionLabel>Registry</SectionLabel>
        <p className="mx-auto mt-4 max-w-2xl font-serif text-2xl leading-relaxed">{site.registry.intro}</p>
        <Link href="/registry" className={`${s.btnSecondary} mt-6`}>
          View registry
        </Link>
      </section>

      <section className={s.section}>
        <div className={`${s.container} grid gap-8 md:grid-cols-[1fr_2fr]`}>
          <div className="space-y-2">
            <SectionLabel>FAQ</SectionLabel>
            <h2 className={s.h2}>Good to know</h2>
            <Link href="/faq" className={s.more}>
              All questions ›
            </Link>
          </div>
          <FaqAccordion items={faqPreview(4)} />
        </div>
      </section>

      <section className="border-t border-mist bg-cream px-5 py-16 text-center sm:py-20">
        <h2 className={s.h2}>{site.home.rsvpPrompt}</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Kindly respond by {deadline}. The QR code on your invitation takes you straight there.
        </p>
        <Link href={rsvpHref} className={`${s.btn} mt-6 w-full max-w-xs`}>
          RSVP
        </Link>
      </section>
    </>
  );
}

export const metadata = { title: { absolute: coupleNames } };
