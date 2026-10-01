import Link from "next/link";
import type { ReactNode } from "react";
import { s } from "@/components/site/styles";
import { coupleNames, site } from "@/content/site";
import { daysUntil, directionsUrl, formatTime, formatWeekdayShort, formatEventTimeRange } from "@/lib/format";
import type { DisplayEvent } from "@/lib/rsvp/view";

/** Component 2: shown on any page opened with an invitation. */
export function ViewingAsPill({ names, token }: { names: string; token: string }) {
  return (
    <div className="border-b border-mist bg-lilac print:hidden">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm text-ink sm:px-8">
        <span aria-hidden>◐</span>
        <span>
          Viewing as <strong className="font-semibold">{names}</strong>
        </span>
        <span aria-hidden className="text-muted">
          ·
        </span>
        <Link href={`/i/${token}`} className="font-semibold underline underline-offset-4">
          Your invitation
        </Link>
        <span aria-hidden className="text-muted">
          ·
        </span>
        <a href="/forget-invitation" className="underline underline-offset-4">
          Not you?
        </a>
      </p>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-mist px-5 py-8 text-sm text-muted sm:px-8 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2">
        <p>
          {coupleNames} · {site.dateLabel} · {site.location}
        </p>
        <p>
          Questions?{" "}
          <a href={`mailto:${site.contactEmail}`} className="underline underline-offset-4">
            {site.contactEmail}
          </a>
        </p>
      </div>
    </footer>
  );
}

/** Component 8: days to go. Not a ticking clock. */
export function Countdown({ className = "" }: { className?: string }) {
  const days = daysUntil(site.weddingDate);
  const text =
    days === null
      ? "[123] days to go"
      : days === 0
        ? "Today’s the day"
        : `${days} ${days === 1 ? "day" : "days"} to go`;
  return (
    <p
      className={`inline-flex min-h-9 items-center rounded-full border border-wisteria bg-white px-4 text-sm text-ink ${className}`}
    >
      {text}
    </p>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className={s.label}>{children}</p>;
}

/** Dashed placeholder box standing in for real photography. */
export function PhotoPlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`Placeholder: ${label}`}
      className={`flex items-center justify-center rounded-lg border border-dashed border-wisteria bg-placeholder p-2 text-center font-mono text-xs text-muted ${className}`}
    >
      [{label}]
    </div>
  );
}

export function ExternalLink({
  href,
  children,
  label,
  className,
}: {
  href: string;
  children: ReactNode;
  label: string;
  className: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label}, opens in new tab`}
      className={className}
    >
      {children} <span aria-hidden>↗</span>
    </a>
  );
}

/**
 * Component 3: event card. Public variant shows details; personal variant
 * adds who from the invitation is attending (or not).
 */
export function EventCard({
  event,
  attending,
  notAttending,
  compact = false,
}: {
  event: DisplayEvent;
  attending?: string[];
  notAttending?: string[];
  compact?: boolean;
}) {
  const time = formatEventTimeRange(event.starts_at, event.ends_at);
  const place = [event.location_name, event.location_address].filter(Boolean).join(" · ");
  const maps = directionsUrl(event.location_address ?? event.location_name);
  const declinedAll = attending !== undefined && attending.length === 0 && (notAttending?.length ?? 0) > 0;

  if (compact) {
    return (
      <div className={`${s.card} flex gap-4`}>
        <p className={`${s.label} w-10 shrink-0 pt-1`}>{formatWeekdayShort(event.starts_at)}</p>
        <div>
          <p className="font-semibold text-ink">{event.name}</p>
          <p className="text-sm text-muted">
            {[formatTime(event.starts_at), event.location_name].filter(Boolean).join(" · ") || "Details coming soon"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <article
      className={`${s.card} ${declinedAll ? "border-dashed bg-white/60" : ""} grid gap-3 sm:grid-cols-[7rem_1fr_auto]`}
    >
      <p className="text-sm font-semibold text-plum">{time ?? "Time TBA"}</p>
      <div className="space-y-1">
        <h3 className="font-serif text-2xl text-ink">{event.name}</h3>
        {place && <p className="text-sm text-muted">{place}</p>}
        {event.description && <p className="text-sm text-ink">{event.description}</p>}
        {event.attire && <p className="text-sm text-ink">Attire: {event.attire}</p>}
        {event.guest_notes && <p className="text-sm text-ink">{event.guest_notes}</p>}
        {attending && attending.length > 0 && (
          <p className="text-sm text-sage">
            <span aria-hidden>✓ </span>Attending: {attending.join(", ")}
          </p>
        )}
        {notAttending && notAttending.length > 0 && (
          <p className="text-sm text-muted">
            <span aria-hidden>✕ </span>
            {notAttending.join(", ")} — not attending
          </p>
        )}
      </div>
      {maps && (
        <div className="sm:text-right">
          <ExternalLink href={maps} label={`Directions to ${event.name}`} className={s.more}>
            Directions
          </ExternalLink>
        </div>
      )}
    </article>
  );
}

/** Component 4: hotel card. */
export function HotelCard({ hotel }: { hotel: (typeof site.travel.hotels)[number] }) {
  return (
    <article className="overflow-hidden rounded-xl border border-mist bg-white">
      <PhotoPlaceholder label="hotel photo" className="h-40 rounded-none border-0 border-b" />
      <div className="space-y-1 p-5">
        <p className={s.label}>{hotel.tag}</p>
        <h3 className={s.h3}>{hotel.name}</h3>
        <p className="text-sm text-muted">{hotel.details}</p>
        <p className="text-sm text-ink">
          Block code: <span className="font-mono">{hotel.code}</span> · until {hotel.until}
        </p>
        <div className="pt-2">
          <ExternalLink href={hotel.url} label={`Book the room block at ${hotel.name}`} className={s.btnSmall}>
            Book room block
          </ExternalLink>
        </div>
      </div>
    </article>
  );
}

/** Component 5: registry card. */
export function RegistryCard({ item }: { item: (typeof site.registry.items)[number] }) {
  return (
    <article className={`${s.card} flex flex-col gap-3`}>
      <PhotoPlaceholder label="provider logo" className="h-16" />
      <h3 className={s.h3}>{item.provider}</h3>
      <p className="flex-1 text-sm text-muted">{item.description}</p>
      <ExternalLink href={item.url} label={`${item.cta}: ${item.provider}`} className={s.btnSecondary}>
        {item.cta}
      </ExternalLink>
    </article>
  );
}

/** Groups events by venue-local day, preserving order. */
export function groupByDay<T extends { starts_at: string | null }>(events: T[]): { day: string; events: T[] }[] {
  const groups: { day: string; events: T[] }[] = [];
  for (const e of events) {
    const day = e.starts_at ? e.starts_at.slice(0, 10) : "tbd";
    const last = groups.at(-1);
    if (last && last.day === day) last.events.push(e);
    else groups.push({ day, events: [e] });
  }
  return groups;
}
