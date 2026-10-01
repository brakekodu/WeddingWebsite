import { FaqAccordion } from "@/components/site/faq-accordion";
import { SectionLabel } from "@/components/site/parts";
import { s } from "@/components/site/styles";
import { site } from "@/content/site";

export const metadata = { title: "FAQ" };

/** FAQ: grouped accordion (RSVP · Attire · Kids & plus-ones · Travel · Day-of). */
export default function FaqPage() {
  return (
    <>
      <section className="bg-lilac px-5 py-14 text-center sm:py-20">
        <SectionLabel>FAQ</SectionLabel>
        <h1 className={`${s.h1} mt-3`}>Good to know</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Can&apos;t find an answer? Email{" "}
          <a href={`mailto:${site.contactEmail}`} className="underline underline-offset-4">
            {site.contactEmail}
          </a>
          .
        </p>
      </section>
      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-3xl space-y-10">
          {site.faq.map((group) => (
            <div key={group.topic} id={group.topic.toLowerCase().replace(/[^a-z]+/g, "-")} className="space-y-3">
              <h2 className="font-serif text-2xl">{group.topic}</h2>
              <FaqAccordion items={group.items} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
