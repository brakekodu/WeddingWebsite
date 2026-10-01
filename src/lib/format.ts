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
