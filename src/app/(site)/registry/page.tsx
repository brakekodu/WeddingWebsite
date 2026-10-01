import { RegistryCard, SectionLabel } from "@/components/site/parts";
import { s } from "@/components/site/styles";
import { site } from "@/content/site";

export const metadata = { title: "Registry" };

/** Registry (screen 17): external links only — no cart, no tracking. */
export default function RegistryPage() {
  const items = site.registry.items;
  return (
    <>
      <section className="bg-lilac px-5 py-14 text-center sm:py-20">
        <SectionLabel>Registry</SectionLabel>
        <h1 className={`${s.h1} mt-3`}>Our registry</h1>
        <p className="mx-auto mt-4 max-w-2xl font-serif text-xl leading-relaxed text-ink">{site.registry.intro}</p>
      </section>
      <section className="px-5 py-12 sm:px-8 sm:py-16">
        <div
          className={`mx-auto grid max-w-5xl gap-6 ${items.length >= 3 ? "md:grid-cols-3" : "max-w-2xl md:grid-cols-2"}`}
        >
          {items.map((item) => (
            <RegistryCard key={item.provider} item={item} />
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted">{site.registry.mailingNote}</p>
      </section>
    </>
  );
}
