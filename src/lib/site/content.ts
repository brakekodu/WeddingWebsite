/**
 * Editable website wording (Admin → Website text).
 *
 * One description per section drives both the admin editor and validation, so
 * a field can't be editable without being checked. Saved sections live in
 * public.site_content; anything missing or invalid falls back to the defaults
 * in src/content/site.ts, so the site never shows a blank.
 */
import { z } from "zod";
import { siteDefaults, type SiteContent, type SiteSection } from "@/content/site";

export type TextKind = "text" | "textarea" | "url" | "email" | "date";

export interface TextField {
  kind: TextKind;
  key: string;
  label: string;
  hint?: string;
  max?: number;
}

export interface ListField {
  kind: "list";
  key: string;
  label: string;
  /** Name of one item, e.g. "Hotel". */
  itemLabel: string;
  hint?: string;
  max: number;
  fields: Field[];
}

export type Field = TextField | ListField;

export interface SectionSpec {
  key: SiteSection;
  title: string;
  description: string;
  fields: Field[];
}

const t = (key: string, label: string, hint?: string, max = 200): TextField => ({
  kind: "text",
  key,
  label,
  hint,
  max,
});
const area = (key: string, label: string, hint?: string, max = 4000): TextField => ({
  kind: "textarea",
  key,
  label,
  hint,
  max,
});
const url = (key: string, label: string): TextField => ({
  kind: "url",
  key,
  label,
  hint: "Starts with https://. Leave as # until you have the link.",
  max: 500,
});

export const SITE_SECTIONS: SectionSpec[] = [
  {
    key: "basics",
    title: "Basics",
    description: "Date, place, and contact details used across the site.",
    fields: [
      {
        kind: "date",
        key: "weddingDate",
        label: "Wedding date",
        hint: "Drives the “days to go” countdown. Leave empty to hide it.",
      },
      t("dateLabel", "Date as guests read it", "e.g. Saturday, June 12, 2027"),
      t("weekendLabel", "Wedding weekend dates", "e.g. June 11–13, 2027 (Weekend page header)"),
      t("location", "City, State", "e.g. Columbus, Ohio"),
      {
        kind: "email",
        key: "contactEmail",
        label: "Contact email",
        hint: "Shown wherever guests are told to email you.",
        max: 254,
      },
      t("dayOfContact", "Wedding-week contact", "Name and phone, shown on invitations."),
    ],
  },
  {
    key: "home",
    title: "Home page",
    description: "The welcome under the photo and the RSVP prompt at the bottom.",
    fields: [area("welcome", "Welcome", "Two or three sentences.", 1200), t("rsvpPrompt", "RSVP heading")],
  },
  {
    key: "story",
    title: "Our story",
    description: "The Story page, and the teaser on the Home page.",
    fields: [
      t("title", "Title"),
      area("teaser", "Teaser", "Shown on Home and at the top of the Story page.", 600),
      {
        kind: "list",
        key: "sections",
        label: "Story sections",
        itemLabel: "Section",
        max: 12,
        fields: [t("title", "Heading"), area("body", "Text", "Blank lines start new paragraphs.", 6000)],
      },
      {
        kind: "list",
        key: "weddingParty",
        label: "Wedding party",
        itemLabel: "Person",
        max: 30,
        fields: [t("name", "Name"), t("role", "Role"), t("blurb", "One line about them", undefined, 300)],
      },
    ],
  },
  {
    key: "weekend",
    title: "Weekend",
    description: "Text around the public schedule. Events themselves are in Admin → Events.",
    fields: [
      area("intro", "Intro", undefined, 600),
      {
        kind: "list",
        key: "goodToKnow",
        label: "Good to know",
        itemLabel: "Note",
        max: 12,
        fields: [t("label", "Label"), area("body", "Text", undefined, 1000)],
      },
    ],
  },
  {
    key: "travel",
    title: "Travel",
    description: "Hotels, airports, shuttles, and local tips.",
    fields: [
      area("intro", "Intro", undefined, 600),
      t("roomBlockDeadline", "Room blocks close on", "e.g. May 1, 2027"),
      {
        kind: "list",
        key: "hotels",
        label: "Hotels",
        itemLabel: "Hotel",
        max: 8,
        fields: [
          t("name", "Hotel name"),
          t("tag", "Tag", "e.g. Primary room block · shuttle stop"),
          t("details", "Details", "e.g. 10 min to venue · from $149/night", 300),
          t("code", "Block code"),
          t("until", "Book by"),
          url("url", "Booking link"),
        ],
      },
      area("otherOptions", "Other places to stay", undefined, 1000),
      {
        kind: "list",
        key: "airports",
        label: "Airports",
        itemLabel: "Airport",
        max: 6,
        fields: [t("label", "Label", "e.g. Recommended"), t("name", "Airport"), t("note", "Note", undefined, 300)],
      },
      {
        kind: "list",
        key: "shuttles",
        label: "Shuttles",
        itemLabel: "Shuttle",
        max: 8,
        fields: [t("label", "Label"), t("from", "From"), t("to", "To"), t("times", "Times")],
      },
      area("parking", "Parking", undefined, 1000),
      area("rideshare", "Rideshare", undefined, 1000),
      {
        kind: "list",
        key: "thingsToDo",
        label: "Things to do",
        itemLabel: "Place",
        max: 20,
        fields: [t("name", "Name"), t("why", "Why we love it", undefined, 300)],
      },
    ],
  },
  {
    key: "gallery",
    title: "Gallery",
    description: "The line under the Gallery heading. Photos are in Admin → Photos.",
    fields: [area("intro", "Intro", undefined, 600)],
  },
  {
    key: "registry",
    title: "Registry",
    description: "Registry links on the Registry page and the Home page.",
    fields: [
      area("intro", "Intro", undefined, 1000),
      {
        kind: "list",
        key: "items",
        label: "Registries",
        itemLabel: "Registry",
        max: 10,
        fields: [
          t("provider", "Name", "e.g. Zola, Amazon, Honeymoon fund"),
          area("description", "Description", undefined, 600),
          url("url", "Link"),
          t("cta", "Button text", "e.g. View registry"),
        ],
      },
      area("mailingNote", "Mailing note", undefined, 600),
    ],
  },
  {
    key: "faq",
    title: "FAQ",
    description: "Questions grouped by topic. The first few also appear on Home and on invitations.",
    fields: [
      {
        kind: "list",
        key: "groups",
        label: "Topics",
        itemLabel: "Topic",
        max: 20,
        fields: [
          t("topic", "Topic"),
          {
            kind: "list",
            key: "items",
            label: "Questions",
            itemLabel: "Question",
            max: 30,
            fields: [t("q", "Question", undefined, 300), area("a", "Answer", undefined, 2000)],
          },
        ],
      },
    ],
  },
];

export function getSectionSpec(key: string): SectionSpec | undefined {
  return SITE_SECTIONS.find((s) => s.key === key);
}

// ----- Validation ------------------------------------------------------------

/** Plain text: no control characters other than line breaks and tabs. */
const NO_CONTROL = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/;
/** Only links that are safe to put in an href. */
const SAFE_URL = /^(#|https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+)$/i;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const PLACEHOLDER = /^\[[^\]]*\]$/;

function textSchema(field: TextField): z.ZodType<string> {
  const max = field.max ?? (field.kind === "textarea" ? 4000 : 200);
  const base = z
    .string()
    .transform((v) => v.replace(/\r\n?/g, "\n").trim())
    .pipe(
      z
        .string()
        .max(max, `${field.label} must be ${max} characters or fewer.`)
        .regex(NO_CONTROL, `${field.label} contains characters that can't be shown.`),
    );
  switch (field.kind) {
    case "url":
      return base.refine((v) => v === "" || SAFE_URL.test(v), {
        message: `${field.label} must start with https:// (or be #).`,
      });
    case "email":
      return base.refine((v) => v === "" || EMAIL.test(v) || PLACEHOLDER.test(v), {
        message: `${field.label} must be an email address.`,
      });
    case "date":
      return base.refine((v) => v === "" || isRealDate(v), { message: `${field.label} must be a date.` });
    default:
      return base;
  }
}

function isRealDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function objectSchema(fields: Field[]): z.ZodObject {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    // A field missing from saved data (e.g. added to the site later) reads as empty.
    shape[field.key] =
      field.kind === "list"
        ? z.preprocess(
            (v) => v ?? [],
            z.array(objectSchema(field.fields)).max(field.max, `${field.label}: at most ${field.max}.`),
          )
        : z.preprocess((v) => v ?? "", textSchema(field));
  }
  // Unknown keys are dropped, so only described fields are ever stored.
  return z.object(shape);
}

const SECTION_SCHEMAS = Object.fromEntries(SITE_SECTIONS.map((s) => [s.key, objectSchema(s.fields)])) as Record<
  SiteSection,
  z.ZodObject
>;

export type SectionParseResult<K extends SiteSection> =
  { ok: true; value: SiteContent[K] } | { ok: false; message: string };

/** Validates one section as submitted from the editor (or read back from the database). */
export function parseSection<K extends SiteSection>(key: K, input: unknown): SectionParseResult<K> {
  const schema = SECTION_SCHEMAS[key];
  if (!schema) return { ok: false, message: "Unknown section." };
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data as SiteContent[K] };
  return { ok: false, message: result.error.issues[0]?.message ?? "Some fields are invalid." };
}

/**
 * The live content: each saved section that still validates replaces the
 * default; everything else keeps its default. Never throws.
 */
export function resolveSiteContent(stored: unknown): SiteContent {
  const content: SiteContent = { ...siteDefaults };
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return content;
  for (const key of Object.keys(siteDefaults) as SiteSection[]) {
    const value = (stored as Record<string, unknown>)[key];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    // Fields saved before they existed in code keep their default.
    const parsed = parseSection(key, { ...siteDefaults[key], ...value });
    if (parsed.ok) (content as Record<SiteSection, unknown>)[key] = parsed.value;
  }
  return content;
}

/** True when text still contains a [placeholder] from the defaults. */
export function hasPlaceholder(value: string): boolean {
  return /\[[^\]]+\]/.test(value);
}

/** Wedding date for the countdown, or null when unset. */
export function weddingDateOf(content: SiteContent): string | null {
  return content.basics.weddingDate || null;
}
