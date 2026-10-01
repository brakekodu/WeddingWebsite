import { PUBLIC_NAV } from "@/components/site/nav";
import { SiteFooter, ViewingAsPill } from "@/components/site/parts";
import { SiteHeader } from "@/components/site/site-header";
import { site } from "@/content/site";
import { invitationNames } from "@/lib/rsvp/flow";
import { getViewer } from "@/lib/site/server";

/** Public website chrome. Visitors who opened their invitation see "Viewing as …". */
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  return (
    <>
      <SiteHeader
        monogram={site.couple.monogram}
        items={PUBLIC_NAV}
        rsvpHref={viewer ? `/i/${viewer.token}` : "/rsvp"}
      />
      {viewer && <ViewingAsPill names={invitationNames(viewer.view)} token={viewer.token} />}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
