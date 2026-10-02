/**
 * Every spot on the website that shows a photo, and how it is cropped.
 *
 * Variants: `default` is one crop used everywhere; banners that render very
 * differently on phones and desktops get separate `desktop` and `phone` crops so
 * faces stay centered on both. Aspect ratios are width / height.
 */
export type VariantName = "default" | "desktop" | "phone";

export interface SlotDef {
  label: string;
  hint: string;
  variants: Partial<Record<VariantName, number>>;
  /** Bundled photo ids shown until an admin chooses something else (one per position). */
  defaults: string[];
  /** Gallery-style list: any number of photos, managed as a whole. */
  list?: boolean;
}

export const SLOTS = {
  "home.hero": {
    label: "Home · top banner",
    hint: "The big photo behind your names. Crop the computer and phone views separately.",
    variants: { desktop: 16 / 9, phone: 3 / 5 },
    defaults: ["156a0913"],
  },
  "home.story": {
    label: "Home · our story preview",
    hint: "Beside “How it started” on the home page.",
    variants: { default: 4 / 5 },
    defaults: ["156a0765"],
  },
  "home.strip": {
    label: "Home · photo strip",
    hint: "Four photos above “View gallery”.",
    variants: { default: 3 / 4 },
    defaults: ["156a1335", "156a1282", "i4a9917", "156a1428"],
  },
  "story.banner": {
    label: "Our Story · banner",
    hint: "Wide photo under the Our Story heading.",
    variants: { desktop: 5 / 2, phone: 1 },
    defaults: ["156a0842"],
  },
  "story.section": {
    label: "Our Story · section photos",
    hint: "Beside “How we met” and “The proposal”.",
    variants: { default: 4 / 5 },
    defaults: ["i4a9779", "156a1406"],
  },
  "invite.welcome": {
    label: "Invitation welcome",
    hint: "What guests see first after scanning their QR code.",
    variants: { default: 4 / 3 },
    defaults: ["156a0842"],
  },
  "travel.banner": {
    label: "Travel & Stay · banner",
    hint: "Wide photo under the Travel & Stay heading.",
    variants: { desktop: 3 / 1, phone: 6 / 5 },
    defaults: ["i4a9875"],
  },
  gallery: {
    label: "Gallery",
    hint: "Every photo on the Gallery page. Thumbnails are cropped; tapping one shows the whole photo.",
    variants: { default: 3 / 4 },
    defaults: [
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
    ],
    list: true,
  },
} satisfies Record<string, SlotDef>;

export type SlotKey = keyof typeof SLOTS;

export const SLOT_KEYS = Object.keys(SLOTS) as SlotKey[];

export function slotDef(slot: string): SlotDef | null {
  return (SLOTS as Record<string, SlotDef>)[slot] ?? null;
}

export function variantNames(def: SlotDef): VariantName[] {
  return (Object.keys(def.variants) as VariantName[]).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}
const ORDER: VariantName[] = ["default", "desktop", "phone"];

/** Positions an admin may fill: fixed slots have one per default; lists allow many. */
export function isValidPosition(def: SlotDef, position: number): boolean {
  if (!Number.isInteger(position) || position < 0) return false;
  return def.list ? position < 500 : position < def.defaults.length;
}

/** Widths rendered for every crop and upload (capped by the source size). */
export const RENDITION_WIDTHS = [640, 1280, 1920] as const;

export function renditionWidths(sourceWidth: number): number[] {
  const widths: number[] = RENDITION_WIDTHS.filter((w) => w <= sourceWidth);
  return widths.length > 0 ? widths : [Math.max(1, Math.floor(sourceWidth))];
}
