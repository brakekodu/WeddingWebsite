import { coupleNames } from "@/content/site";
import { buildIcs } from "@/lib/calendar";
import { getPublicSite } from "@/lib/site/server";

/** Public events only, as an .ics file. */
export async function GET(request: Request) {
  const { events } = await getPublicSite();
  const origin = new URL(request.url).origin;
  const ics = buildIcs(events, {
    calendarName: `${coupleNames} — wedding weekend`,
    uidDomain: new URL(origin).hostname,
    url: `${origin}/weekend`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wedding-weekend.ics"',
      "Cache-Control": "no-store",
    },
  });
}
