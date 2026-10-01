import { describe, expect, it } from "vitest";
import { buildIcs } from "./calendar";
import { daysUntil, formatDayHeading, formatTime } from "./format";

const ceremony = {
  id: "abc",
  name: "Ceremony",
  description: "Vows, then cocktails; see you there",
  starts_at: "2027-06-12T16:30:00",
  ends_at: null,
  time_zone: "America/New_York",
  location_name: "The Garden",
  location_address: "1 Main St, Town",
  attire: "Garden formal",
  guest_notes: null,
};

describe("buildIcs", () => {
  it("writes venue-local times with TZID and escapes text", () => {
    const ics = buildIcs([ceremony], {
      calendarName: "Kevin & Sarina",
      uidDomain: "kevinandsarina.com",
      now: new Date("2026-10-01T00:00:00Z"),
    });
    expect(ics).toContain("DTSTART;TZID=America/New_York:20270612T163000\r\n");
    expect(ics).toContain("DTEND;TZID=America/New_York:20270612T183000\r\n"); // default 2h
    expect(ics).toContain("UID:abc@kevinandsarina.com");
    expect(ics).toContain("LOCATION:The Garden\\, 1 Main St\\, Town");
    expect(ics).toContain("SUMMARY:Ceremony");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it("skips events without a time and uses floating time without a zone", () => {
    const ics = buildIcs(
      [
        { ...ceremony, id: "x", starts_at: null },
        { ...ceremony, time_zone: null },
      ],
      {
        calendarName: "c",
        uidDomain: "d",
      },
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain("DTSTART:20270612T163000");
  });
});

describe("format helpers", () => {
  it("formats venue-local days and times", () => {
    expect(formatDayHeading("2027-06-12T16:30:00")).toBe("Saturday · June 12");
    expect(formatTime("2027-06-12T16:30:00")).toBe("4:30 PM");
  });

  it("counts whole days to the wedding", () => {
    const now = new Date("2027-06-01T23:00:00Z");
    expect(daysUntil("2027-06-12", now)).toBe(11);
    expect(daysUntil("2027-06-01", now)).toBe(0);
    expect(daysUntil("2027-05-01", now)).toBeNull();
    expect(daysUntil(null, now)).toBeNull();
  });
});
