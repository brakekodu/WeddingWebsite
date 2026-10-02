import { HotelCard, PhotoPlaceholder, SectionLabel } from "@/components/site/parts";
import { SitePhoto } from "@/components/site/photo";
import { s } from "@/components/site/styles";
import { PLACEMENTS } from "@/content/photos";
import { site } from "@/content/site";

export const metadata = { title: "Travel & Stay" };

const ANCHORS = [
  { id: "stay", label: "Where to stay" },
  { id: "getting-there", label: "Getting there" },
  { id: "getting-around", label: "Getting around" },
  { id: "things-to-do", label: "Things to do" },
];

/** Travel & Stay (screen 16): one page with in-page anchors. */
export default function TravelPage() {
  const t = site.travel;
  return (
    <>
      <section className="bg-lilac px-5 py-14 text-center sm:py-20">
        <SectionLabel>Travel &amp; stay</SectionLabel>
        <h1 className={`${s.h1} mt-3`}>Travel &amp; stay</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">{t.intro}</p>
        <nav aria-label="On this page" className="mt-6 flex flex-wrap justify-center gap-2">
          {ANCHORS.map((a) => (
            <a
              key={a.id}
              href={`#${a.id}`}
              className="inline-flex min-h-11 items-center rounded-full border border-wisteria bg-white px-4 text-sm"
            >
              {a.label}
            </a>
          ))}
        </nav>
      </section>

      <SitePhoto photo={PLACEMENTS.travelHero} sizes="100vw" priority className="h-[40svh] w-full sm:h-[55vh]" />

      <section id="stay" className={`${s.section} scroll-mt-20`}>
        <div className={`${s.container} space-y-6`}>
          <h2 className={s.h2}>Where to stay</h2>
          <p role="note" className="rounded-lg border border-plum/30 bg-lilac p-3 text-sm">
            <span aria-hidden>! </span>Room blocks close {t.roomBlockDeadline}
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {t.hotels.map((h) => (
              <HotelCard key={h.name} hotel={h} />
            ))}
            <article className="overflow-hidden rounded-xl border border-mist bg-white">
              <PhotoPlaceholder label="area photo" className="h-40 rounded-none border-0 border-b" />
              <div className="space-y-1 p-5">
                <p className={s.label}>Other options</p>
                <h3 className={s.h3}>Rentals &amp; nearby</h3>
                <p className="text-sm text-muted">{t.otherOptions}</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="getting-there" className={`${s.section} scroll-mt-20`}>
        <div className={`${s.container} space-y-6`}>
          <h2 className={s.h2}>Getting there</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {t.airports.map((a) => (
              <div key={a.name} className={s.card}>
                <p className={s.label}>{a.label}</p>
                <p className="mt-1 font-semibold">{a.name}</p>
                <p className="text-sm text-muted">{a.note}</p>
              </div>
            ))}
          </div>
          <PhotoPlaceholder label="map: airports, hotels, venues" className="h-56" />
        </div>
      </section>

      <section id="getting-around" className={`${s.section} scroll-mt-20`}>
        <div className={`${s.container} space-y-6`}>
          <h2 className={s.h2}>Getting around</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="mb-2 text-left font-semibold">Shuttle</caption>
              <thead className="border-b border-mist text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium" />
                  <th scope="col" className="py-2 pr-4 font-medium">
                    From
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    To
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Times
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.shuttles.map((row) => (
                  <tr key={row.label} className="border-b border-mist">
                    <th scope="row" className="py-3 pr-4 font-semibold">
                      {row.label}
                    </th>
                    <td className="py-3 pr-4">{row.from}</td>
                    <td className="py-3 pr-4">{row.to}</td>
                    <td className="py-3">{row.times}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className={s.card}>
              <p className="font-semibold">Parking</p>
              <p className="text-sm text-muted">{t.parking}</p>
            </div>
            <div className={s.card}>
              <p className="font-semibold">Rideshare</p>
              <p className="text-sm text-muted">{t.rideshare}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="things-to-do" className={`${s.section} scroll-mt-20`}>
        <div className={`${s.container} space-y-6`}>
          <h2 className={s.h2}>Things to do</h2>
          <ul className="grid gap-6 md:grid-cols-3">
            {t.thingsToDo.map((thing) => (
              <li key={thing.name} className="space-y-2">
                <PhotoPlaceholder label="photo" className="aspect-[4/3]" />
                <p className="font-semibold">{thing.name}</p>
                <p className="text-sm text-muted">{thing.why}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
