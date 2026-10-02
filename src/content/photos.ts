/**
 * The bundled engagement photos (public/photos, produced by `npm run photos`),
 * with alt text for screen readers and the point to keep centered when an
 * image is cropped automatically. These are the defaults; the admin can swap
 * any spot to another photo and crop it (Admin → Photos). Default placements
 * live in src/lib/media/slots.ts.
 */
import { PHOTO_FILES } from "@/content/photos.generated";

type PhotoId = (typeof PHOTO_FILES)[number]["id"];

export interface BundledPhoto {
  id: PhotoId;
  alt: string;
  width: number;
  height: number;
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

export const PHOTOS = {} as Record<PhotoId, BundledPhoto>;
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

export const BUNDLED_PHOTOS: BundledPhoto[] = Object.values(PHOTOS);
