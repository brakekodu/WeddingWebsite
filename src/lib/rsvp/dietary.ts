/** Dietary chips offered in the RSVP flow. Keys must match the database CHECK constraint. */
export const DIETARY_TAGS = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "gluten_free", label: "Gluten-free" },
  { key: "dairy_free", label: "Dairy-free" },
  { key: "nut_allergy", label: "Nut allergy" },
  { key: "shellfish", label: "Shellfish" },
  { key: "other", label: "Other" },
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number]["key"];

const LABELS = new Map<string, string>(DIETARY_TAGS.map((t) => [t.key, t.label]));

export function dietaryLabel(tag: string): string {
  return LABELS.get(tag) ?? tag;
}

/** "Gluten-free, Nut allergy · severe" — chips plus free-text details. */
export function describeDietary(tags: readonly string[], details: string | null | undefined): string {
  const parts = tags.map(dietaryLabel).join(", ");
  const extra = details?.trim();
  return [parts, extra].filter(Boolean).join(" · ");
}
