"use client";

/* eslint-disable @next/next/no-img-element -- static responsive WebP files */
import { useEffect, useRef, useState } from "react";
import type { ResolvedPhoto } from "@/lib/media/resolve";

const ROUND_BUTTON =
  "flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-2xl text-ink hover:bg-white";

/** Component 7: gallery grid with a lightbox (arrows, swipe-free buttons, Esc closes, focus returns). */
export function GalleryGrid({ photos }: { photos: ResolvedPhoto[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (index !== null && !dialog.open) dialog.showModal();
  }, [index]);

  const close = () => {
    const last = index;
    dialogRef.current?.close();
    setIndex(null);
    if (last !== null) triggerRefs.current[last]?.focus();
  };
  const step = (delta: number) => setIndex((i) => (i === null ? i : (i + delta + photos.length) % photos.length));

  const current = index === null ? null : photos[index];

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => {
          // Admin-cropped thumbnail when set; otherwise the whole photo centered on its focus.
          const thumb = p.variants.default ?? p.full;
          return (
            <li key={p.key}>
              <button
                ref={(el) => {
                  triggerRefs.current[i] = el;
                }}
                type="button"
                onClick={() => setIndex(i)}
                className="group block w-full overflow-hidden rounded-lg"
                aria-label={`View larger: ${p.alt}`}
              >
                <img
                  src={thumb.src}
                  srcSet={thumb.srcSet}
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                  alt=""
                  width={thumb.width}
                  height={thumb.height}
                  loading="lazy"
                  decoding="async"
                  style={thumb === p.full ? { objectPosition: p.focus } : undefined}
                  className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => index !== null && close()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        onClick={(e) => e.target === dialogRef.current && close()}
        aria-label="Photo viewer"
        className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-plum-deep/90"
      >
        {current && (
          <figure className="flex h-[100svh] w-screen flex-col items-center justify-center gap-3 p-4">
            <img
              src={current.full.src}
              srcSet={current.full.srcSet}
              sizes="100vw"
              alt={current.alt}
              width={current.full.width}
              height={current.full.height}
              className="max-h-[80svh] w-auto max-w-full rounded-lg object-contain"
            />
            <figcaption className="text-center text-sm text-white">
              {index! + 1} of {photos.length}
            </figcaption>
            <div className="flex gap-3">
              <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className={ROUND_BUTTON}>
                <span aria-hidden>‹</span>
              </button>
              <button type="button" onClick={close} aria-label="Close" className={ROUND_BUTTON}>
                <span aria-hidden>×</span>
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next photo" className={ROUND_BUTTON}>
                <span aria-hidden>›</span>
              </button>
            </div>
          </figure>
        )}
      </dialog>
    </>
  );
}
