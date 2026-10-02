import { GalleryGrid } from "@/components/site/gallery-grid";
import { SectionLabel } from "@/components/site/parts";
import { s } from "@/components/site/styles";
import { resolveSlotList } from "@/lib/media/resolve";
import { getSiteMedia } from "@/lib/media/server";
import { site } from "@/content/site";

export const metadata = { title: "Gallery" };

/** Gallery: engagement photos now; moderated guest uploads after the wedding (later phase). */
export default async function GalleryPage() {
  const media = await getSiteMedia();
  return (
    <>
      <section className="bg-lilac px-5 py-14 text-center sm:py-20">
        <SectionLabel>Gallery</SectionLabel>
        <h1 className={`${s.h1} mt-3`}>Photos</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">{site.gallery.intro}</p>
      </section>
      <section className="px-4 py-10 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <GalleryGrid photos={resolveSlotList(media, "gallery")} />
        </div>
      </section>
    </>
  );
}
