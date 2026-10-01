import { getAdmin } from "@/lib/auth/admin";
import { getAppBaseUrl } from "@/lib/env";
import { generateQrSvg } from "@/lib/invitations/qr";
import { buildInvitationUrl } from "@/lib/invitations/url";

/** Vendor-neutral QR artwork for one invitation. Admin only (layouts do not guard route handlers). */
export async function GET(_request: Request, ctx: RouteContext<"/admin/invitations/[id]/qr.svg">) {
  const admin = await getAdmin();
  if (!admin) return new Response("Not authorized", { status: 401 });

  const { id } = await ctx.params;
  const { data: invitation } = await admin.supabase
    .from("invitations")
    .select("token, rsvp_code")
    .eq("id", id)
    .maybeSingle();
  if (!invitation) return new Response("Not found", { status: 404 });

  const svg = generateQrSvg(buildInvitationUrl(getAppBaseUrl(), invitation.token));
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="invitation-${invitation.rsvp_code}.svg"`,
      "Cache-Control": "private, no-store",
    },
  });
}
