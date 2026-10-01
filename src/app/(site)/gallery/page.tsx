import { PhotoPlaceholder, SectionLabel } from "@/components/site/parts";
import { s } from "@/components/site/styles";
import { site } from "@/content/site";

export const metadata = { title: "Gallery" };

/** Gallery: engagement photos now; moderated guest uploads after the wedding (later phase). */
export default function GalleryPage() {
  const photos = site.gallery.photos;
  return (
    <>
      <section className="bg-lilac px-5 py-14 text-center sm:py-20">
        <SectionLabel>Gallery</SectionLabel>
        <h1 className={`${s.h1} mt-3`}>Photos</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">{site.gallery.intro}</p>
      </section>
      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <ul className={`${s.container} grid grid-cols-2 gap-4 md:grid-cols-3`}>
          {photos.length > 0
            ? photos.map((p) => (
                <li key={p.src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.alt} className="aspect-[3/4] w-full rounded-lg object-cover" loading="lazy" />
                </li>
              ))
            : Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  <PhotoPlaceholder label={`photo ${i + 1}`} className="aspect-[3/4]" />
                </li>
              ))}
        </ul>
      </section>
    </>
  );
}
