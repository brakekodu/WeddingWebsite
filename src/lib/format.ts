/**
 * Event times are stored as venue-local wall-clock strings
 * ("2027-06-12T16:00:00"). Formatting them as UTC displays exactly the stored
 * wall-clock time on both server and client, regardless of viewer time zone.
 */
const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });

function parseLocal(value: string): Date | null {
  const date = new Date(`${value.slice(0, 19)}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatEventDate(startsAt: string | null): string | null {
  const start = startsAt ? parseLocal(startsAt) : null;
  return start ? dateFormat.format(start) : null;
}

export function formatEventTimeRange(startsAt: string | null, endsAt: string | null): string | null {
  const start = startsAt ? parseLocal(startsAt) : null;
  if (!start) return null;
  const end = endsAt ? parseLocal(endsAt) : null;
  return end ? `${timeFormat.format(start)} – ${timeFormat.format(end)}` : timeFormat.format(start);
}

/** "2027-06-12T16:00:00" -> "2027-06-12T16:00" for <input type="datetime-local">. */
export function toDateTimeLocalInput(value: string | null): string {
  return value ? value.slice(0, 16) : "";
}

const stampFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** For real instants (timestamptz), shown in the viewer's local time. */
export function formatTimestamp(value: string | null): string {
  return value ? stampFormat.format(new Date(value)) : "—";
}

const monthDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const weekdayLong = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** "2027-06-12T16:00:00" -> "2027-06-12" (venue-local day). */
export function eventDayKey(startsAt: string | null): string {
  return startsAt ? startsAt.slice(0, 10) : "tbd";
}

/** "Saturday · June 12". */
export function formatDayHeading(startsAt: string | null): string {
  const d = startsAt ? parseLocal(startsAt) : null;
  if (!d) return "Date to be announced";
  return `${weekdayLong.format(d)} · ${monthDay.format(d)}`;
}

/** "Sat". */
export function formatWeekdayShort(startsAt: string | null): string {
  const d = startsAt ? parseLocal(startsAt) : null;
  return d ? weekdayShort.format(d) : "TBD";
}

/** "4:30 PM". */
export function formatTime(startsAt: string | null): string | null {
  const d = startsAt ? parseLocal(startsAt) : null;
  return d ? timeFormat.format(d) : null;
}

/** "YYYY-MM-DD" -> "May 1, 2027". */
export function formatDateOnly(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  return longDate.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

/** ISO instant -> "Sep 30". */
export function formatShortDate(value: string | null): string | null {
  return value ? shortDate.format(new Date(value)) : null;
}

/** Whole days from today until a YYYY-MM-DD date (0 on the day; null if past or unset). */
export function daysUntil(date: string | null, now: Date = new Date()): number | null {
  if (!date) return null;
  const target = Date.parse(`${date}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.round((target - today) / 86_400_000);
  return days >= 0 ? days : null;
}

/** Google Maps search link for an address (or venue name). */
export function directionsUrl(place: string | null | undefined): string | null {
  const q = place?.trim();
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}
