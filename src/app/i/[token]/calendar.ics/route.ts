import { coupleNames } from "@/content/site";
import { buildIcs } from "@/lib/calendar";
import { fetchInvitationView } from "@/lib/invitations/server";
import { personalEvents } from "@/lib/rsvp/portal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** This invitation's events as an .ics file: events someone is attending, or all invited events before responding. */
export async function GET(request: Request, ctx: RouteContext<"/i/[token]/calendar.ics">) {
  const { token } = await ctx.params;
  const view = await fetchInvitationView(await createSupabaseServerClient(), token);
  if (!view) return new Response("Not found", { status: 404 });

  const schedule = personalEvents(view);
  const anyAnswered = schedule.some((p) => p.attending.length + p.notAttending.length > 0);
  const events = schedule
    .filter((p) => !p.event.rsvp_required || !anyAnswered || p.attending.length > 0)
    .map((p) => p.event);

  const origin = new URL(request.url).origin;
  const ics = buildIcs(events, {
    calendarName: `${coupleNames} — wedding weekend`,
    uidDomain: new URL(origin).hostname,
    url: `${origin}/i/${token}`,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="our-wedding-weekend.ics"',
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
