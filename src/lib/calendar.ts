/**
 * iCalendar (.ics) export for "Add to calendar". Event times are venue-local
 * wall-clock times; with a time zone they are written with TZID (understood by
 * Google, Apple, and Outlook), otherwise as floating local times.
 */
import type { DisplayEvent } from "@/lib/rsvp/view";

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding at 75 octets. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** "2027-06-12T16:30:00" -> "20270612T163000". */
function localStamp(value: string): string {
  return value.slice(0, 19).replace(/[-:]/g, "");
}

function utcStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function addHours(value: string, hours: number): string {
  const d = new Date(`${value.slice(0, 19)}Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString().slice(0, 19);
}

export function buildIcs(
  events: DisplayEvent[],
  options: { calendarName: string; uidDomain: string; url?: string; now?: Date },
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brake Wedding//RSVP//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.calendarName)}`,
  ];
  const stamp = utcStamp(options.now ?? new Date());
  for (const e of events) {
    if (!e.starts_at) continue;
    const end = e.ends_at ?? addHours(e.starts_at, 2);
    const tz = e.time_zone ? `;TZID=${e.time_zone}` : "";
    const description = [e.description, e.attire ? `Attire: ${e.attire}` : null, e.guest_notes, options.url]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@${options.uidDomain}`,
      `DTSTAMP:${stamp}`,
      `DTSTART${tz}:${localStamp(e.starts_at)}`,
      `DTEND${tz}:${localStamp(end)}`,
      `SUMMARY:${escapeText(e.name)}`,
    );
    const location = [e.location_name, e.location_address].filter(Boolean).join(", ");
    if (location) lines.push(`LOCATION:${escapeText(location)}`);
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
