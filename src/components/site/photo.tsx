/* eslint-disable @next/next/no-img-element -- static responsive images served by Cloudflare; no optimizer needed */
import type { ResolvedPhoto } from "@/lib/media/resolve";

/** Matches Tailwind's md breakpoint: desktop crops apply from here up. */
const DESKTOP_MEDIA = "(min-width: 768px)";

/**
 * A photo placed in a spot on the site. Uses the admin's crop when one exists
 * (separate phone/desktop crops via <picture>), otherwise the whole photo
 * centered on its focal point. `sizes` lets browsers download the smallest
 * file that still looks sharp.
 */
export function SlotImage({
  photo,
  sizes,
  className = "",
  priority = false,
}: {
  photo: ResolvedPhoto;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  const { desktop, phone } = photo.variants;
  const main = photo.variants.default ?? phone ?? desktop ?? photo.full;
  const cropped = main !== photo.full;
  const img = (
    <img
      src={main.src}
      srcSet={main.srcSet}
      sizes={sizes}
      alt={photo.alt}
      width={main.width}
      height={main.height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      style={cropped ? undefined : { objectPosition: photo.focus }}
      className={`object-cover ${className}`}
    />
  );
  if (desktop && phone) {
    return (
      <picture className="contents">
        <source
          media={DESKTOP_MEDIA}
          srcSet={desktop.srcSet}
          sizes={sizes}
          width={desktop.width}
          height={desktop.height}
        />
        {img}
      </picture>
    );
  }
  return img;
}
