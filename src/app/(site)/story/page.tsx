import { PhotoPlaceholder, SectionLabel } from "@/components/site/parts";
import { SlotImage } from "@/components/site/photo";
import { s } from "@/components/site/styles";
import { resolveSlot, resolveSlotList } from "@/lib/media/resolve";
import { getSiteMedia } from "@/lib/media/server";
import { site } from "@/content/site";

export const metadata = { title: "Our Story" };

/** Our Story, with the Wedding Party as a section (merged, not its own nav item). */
export default async function StoryPage() {
  const media = await getSiteMedia();
  const sectionPhotos = resolveSlotList(media, "story.section");
  return (
    <>
      <section className="bg-lilac px-5 py-14 text-center sm:py-20">
        <SectionLabel>Our story</SectionLabel>
        <h1 className={`${s.h1} mt-3`}>{site.story.title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">{site.story.teaser}</p>
      </section>

      <SlotImage
        photo={resolveSlot(media, "story.banner")}
        sizes="100vw"
        priority
        className="h-[45svh] w-full sm:h-[60vh]"
      />

      {site.story.sections.map((section, i) => {
        const photo = sectionPhotos[i];
        return (
          <section key={section.title} className={s.section}>
            <div className={`${s.container} grid items-center gap-8 md:grid-cols-2`}>
              {photo ? (
                <SlotImage
                  photo={photo}
                  sizes="(min-width: 768px) 480px, 100vw"
                  className={`aspect-[4/5] w-full rounded-xl ${i % 2 ? "md:order-2" : ""}`}
                />
              ) : (
                <PhotoPlaceholder
                  label={`${section.title.toLowerCase()} photo`}
                  className={`aspect-[4/3] ${i % 2 ? "md:order-2" : ""}`}
                />
              )}
              <div className="space-y-3">
                <h2 className={s.h2}>{section.title}</h2>
                <p className={`${s.body} whitespace-pre-line`}>{section.body}</p>
              </div>
            </div>
          </section>
        );
      })}

      <section id="wedding-party" className={s.section}>
        <div className={`${s.container} space-y-6`}>
          <div>
            <SectionLabel>The wedding party</SectionLabel>
            <h2 className={`${s.h2} mt-2`}>The people standing with us</h2>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            {site.story.weddingParty.map((person, i) => (
              <li key={`${person.name}-${i}`} className="space-y-2">
                <PhotoPlaceholder label="portrait" className="aspect-square" />
                <p className="font-semibold">{person.name}</p>
                <p className={s.label}>{person.role}</p>
                <p className="text-sm text-muted">{person.blurb}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
