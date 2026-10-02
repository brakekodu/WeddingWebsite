/* eslint-disable @next/next/no-img-element -- static responsive WebP files served by Cloudflare; no image optimizer needed */
import { photoSrc, photoSrcSet, type Photo } from "@/content/photos";

/**
 * Responsive engagement photo. `sizes` tells the browser how wide the image
 * renders so it downloads the smallest file that looks sharp.
 */
export function SitePhoto({
  photo,
  sizes,
  className = "",
  priority = false,
}: {
  photo: Photo;
  sizes: string;
  className?: string;
  /** Load immediately (above the fold, e.g. the hero). */
  priority?: boolean;
}) {
  return (
    <img
      src={photoSrc(photo, photo.widths.includes(1280) ? 1280 : photo.widths.at(-1)!)}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      alt={photo.alt}
      width={photo.width}
      height={photo.height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      style={{ objectPosition: photo.focus }}
      className={`object-cover ${className}`}
    />
  );
}
