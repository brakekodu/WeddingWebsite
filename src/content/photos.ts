/**
 * Engagement photos used on the site. Files are produced by `npm run photos`
 * (see scripts/optimize-photos.ts); this file adds the human parts: alt text
 * for screen readers and where to keep the faces when an image is cropped.
 */
import { PHOTO_FILES } from "@/content/photos.generated";

type PhotoId = (typeof PHOTO_FILES)[number]["id"];

export interface Photo {
  id: PhotoId;
  alt: string;
  width: number;
  height: number;
  /** Largest-first list of available widths. */
  widths: readonly number[];
  /** CSS object-position used when the photo is cropped, e.g. "50% 30%". */
  focus: string;
}

const DETAILS: Record<PhotoId, { alt: string; focus?: string }> = {
  "156a0506": { alt: "Kevin and Sarina standing together between tall stone columns", focus: "50% 70%" },
  "156a0765": { alt: "Kevin hugging Sarina from behind, both laughing" },
  "156a0792": { alt: "Kevin and Sarina standing on a garden path lined with flowers", focus: "50% 55%" },
  "156a0842": {
    alt: "Kevin and Sarina sitting on the lawn, sharing a kiss in front of white flowers",
    focus: "60% 70%",
  },
  "156a0913": { alt: "Kevin and Sarina about to kiss, backlit by the golden evening sun", focus: "53% 30%" },
  "156a1282": { alt: "Kevin and Sarina sitting on a park bench under green trees", focus: "55% 65%" },
  "156a1335": { alt: "Kevin and Sarina holding hands on a sunny park path", focus: "50% 40%" },
  "156a1403": { alt: "Sarina with her arm around Kevin, both smiling in the park", focus: "50% 35%" },
  "156a1406": { alt: "Sarina hugging Kevin, her engagement ring visible on his chest", focus: "50% 40%" },
  "156a1428": { alt: "Kevin and Sarina lounging on a stone ledge at sunset", focus: "55% 60%" },
  i4a9779: { alt: "Sarina resting her head on Kevin's shoulder", focus: "50% 30%" },
  i4a9813: { alt: "Kevin and Sarina sitting on the edge of a fountain, leaning in close", focus: "60% 55%" },
  i4a9825: {
    alt: "Kevin and Sarina in front of a stone memorial wall and fountain, white flowers below",
    focus: "50% 35%",
  },
  i4a9830: { alt: "Kevin and Sarina standing on the lawn in front of a stone wall and flower beds", focus: "50% 55%" },
  i4a9875: {
    alt: "A curved stone overlook above the river at sunset, with Kevin and Sarina in the distance",
    focus: "50% 40%",
  },
  i4a9917: { alt: "Kevin and Sarina on wide stone steps glowing in the sunset", focus: "50% 50%" },
};

export const PHOTOS = {} as Record<PhotoId, Photo>;
for (const f of PHOTO_FILES) {
  PHOTOS[f.id] = {
    id: f.id,
    alt: DETAILS[f.id].alt,
    width: f.width,
    height: f.height,
    widths: f.widths,
    focus: DETAILS[f.id].focus ?? "50% 50%",
  };
}

export function photo(id: PhotoId): Photo {
  return PHOTOS[id];
}

/** Where each photo appears. Change ids here to rearrange the site. */
export const PLACEMENTS = {
  homeHero: photo("156a0913"),
  homeStory: photo("156a0765"),
  homeStrip: [photo("156a1335"), photo("156a1282"), photo("i4a9917"), photo("156a1428")],
  storyBanner: photo("156a0842"),
  storySections: [photo("i4a9779"), photo("156a1406")],
  inviteWelcome: photo("156a0842"),
  travelHero: photo("i4a9875"),
  /** Gallery order. */
  gallery: [
    "156a0913",
    "156a0765",
    "i4a9779",
    "156a0842",
    "156a1406",
    "i4a9917",
    "156a1282",
    "i4a9825",
    "156a1335",
    "i4a9813",
    "156a1428",
    "156a0506",
    "156a1403",
    "i4a9830",
    "156a0792",
    "i4a9875",
  ].map((id) => photo(id as PhotoId)),
};

export function photoSrc(p: Photo, width: number): string {
  return `/photos/${p.id}-${width}.webp`;
}

export function photoSrcSet(p: Photo): string {
  return p.widths.map((w) => `${photoSrc(p, w)} ${w}w`).join(", ");
}
