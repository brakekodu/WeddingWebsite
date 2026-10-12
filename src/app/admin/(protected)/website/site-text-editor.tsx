"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { ui } from "@/components/ui/styles";
import type { SiteContent, SiteSection } from "@/content/site";
import { hasPlaceholder, SITE_SECTIONS, type Field, type ListField, type TextField } from "@/lib/site/content";
import { resetSiteSection, saveSiteSection } from "./actions";

type Item = Record<string, unknown>;

/** Where guests see each section, for the "View on site" link. */
const PAGE: Record<SiteSection, string> = {
  basics: "/",
  home: "/",
  story: "/story",
  weekend: "/weekend",
  travel: "/travel",
  gallery: "/gallery",
  registry: "/registry",
  faq: "/faq",
};

function countPlaceholders(fields: Field[], value: Item): number {
  let n = 0;
  for (const f of fields) {
    const v = value[f.key];
    if (f.kind === "list") for (const item of (v as Item[] | undefined) ?? []) n += countPlaceholders(f.fields, item);
    else if (typeof v === "string" && hasPlaceholder(v)) n++;
  }
  return n;
}

function emptyItem(fields: Field[]): Item {
  return Object.fromEntries(fields.map((f) => [f.key, f.kind === "list" ? [] : ""]));
}

export function SiteTextEditor({ initial, customized }: { initial: SiteContent; customized: SiteSection[] }) {
  const [dirty, setDirty] = useState<Partial<Record<SiteSection, boolean>>>({});
  const anyDirty = Object.values(dirty).some(Boolean);

  // Warn before leaving the page with unsaved edits.
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  return (
    <div className="space-y-4">
      <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
        {SITE_SECTIONS.map((s) => (
          <a key={s.key} href={`#section-${s.key}`} className={ui.buttonSecondary}>
            {s.title}
            {dirty[s.key] && <span aria-label="unsaved changes">•</span>}
          </a>
        ))}
      </nav>
      {SITE_SECTIONS.map((spec) => (
        <SectionEditor
          key={spec.key}
          section={spec.key}
          initial={initial[spec.key] as unknown as Item}
          customized={customized.includes(spec.key)}
          onDirtyChange={(d) => setDirty((prev) => (prev[spec.key] === d ? prev : { ...prev, [spec.key]: d }))}
        />
      ))}
    </div>
  );
}

function SectionEditor({
  section,
  initial,
  customized,
  onDirtyChange,
}: {
  section: SiteSection;
  initial: Item;
  customized: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const spec = SITE_SECTIONS.find((s) => s.key === section)!;
  const [value, setValue] = useState<Item>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const isDirty = JSON.stringify(value) !== saved;
  const placeholders = countPlaceholders(spec.fields, value);

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  // After a save/reset the server re-renders with fresh content; adopt it when there are no local edits.
  const initialJson = JSON.stringify(initial);
  const [lastInitial, setLastInitial] = useState(initialJson);
  if (initialJson !== lastInitial) {
    setLastInitial(initialJson);
    if (!isDirty) {
      setValue(initial);
      setSaved(initialJson);
    }
  }

  function save() {
    setStatus(null);
    startTransition(async () => {
      const result = await saveSiteSection(section, value);
      if (result?.ok) setSaved(JSON.stringify(value));
      setStatus(result ? { ok: result.ok, text: result.message } : null);
    });
  }

  function reset() {
    if (!window.confirm(`Put “${spec.title}” back to the original wording? Your edits to this section will be lost.`)) {
      return;
    }
    setStatus(null);
    startTransition(async () => {
      const result = await resetSiteSection(section);
      setStatus(result ? { ok: result.ok, text: result.message } : null);
    });
  }

  return (
    <section id={`section-${section}`} aria-labelledby={`title-${section}`} className={`${ui.card} scroll-mt-4`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`title-${section}`} className={`${ui.h2} flex flex-wrap items-center gap-2`}>
            {spec.title}
            {customized ? <Badge tone="info">Edited</Badge> : <Badge>Original wording</Badge>}
            {placeholders > 0 && (
              <Badge tone="warn">
                {placeholders} placeholder{placeholders === 1 ? "" : "s"} left
              </Badge>
            )}
          </h2>
          <p className="text-sm text-stone-600">{spec.description}</p>
        </div>
        <a href={PAGE[section]} target="_blank" rel="noopener noreferrer" className={`${ui.link} text-sm`}>
          View on site ↗
        </a>
      </div>

      <div className="space-y-4">
        {spec.fields.map((field) => (
          <FieldEditor
            key={field.key}
            field={field}
            value={value[field.key]}
            onChange={(v) => setValue((prev) => ({ ...prev, [field.key]: v }))}
          />
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-stone-200 bg-white px-4 pt-4 pb-2 sm:-mx-6 sm:px-6">
        <button type="button" className={ui.button} onClick={save} disabled={pending || !isDirty}>
          {pending ? "Saving…" : isDirty ? `Save ${spec.title}` : "No changes"}
        </button>
        {isDirty && (
          <button
            type="button"
            className={ui.buttonSecondary}
            disabled={pending}
            onClick={() => {
              setValue(JSON.parse(saved) as Item);
              setStatus(null);
            }}
          >
            Undo changes
          </button>
        )}
        {customized && !isDirty && (
          <button type="button" className={ui.buttonSecondary} disabled={pending} onClick={reset}>
            Reset to original
          </button>
        )}
        {status && (
          <p
            role={status.ok ? "status" : "alert"}
            className={`text-sm ${status.ok ? "text-emerald-700" : "text-red-700"}`}
          >
            {status.text}
          </p>
        )}
      </div>
    </section>
  );
}

function FieldEditor({ field, value, onChange }: { field: Field; value: unknown; onChange: (value: unknown) => void }) {
  if (field.kind === "list") {
    return <ListEditor field={field} items={(value as Item[] | undefined) ?? []} onChange={onChange} />;
  }
  return <TextEditor field={field} value={typeof value === "string" ? value : ""} onChange={onChange} />;
}

function TextEditor({ field, value, onChange }: { field: TextField; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const placeholder = hasPlaceholder(value);
  const common = {
    id,
    value,
    maxLength: field.max,
    "aria-describedby": field.hint ? hintId : undefined,
    className: `${ui.input} ${placeholder ? "border-amber-300 bg-amber-50/40" : ""}`,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <div>
      <label htmlFor={id} className={`${ui.label} flex flex-wrap items-center gap-2`}>
        {field.label}
        {placeholder && <Badge tone="warn">placeholder</Badge>}
      </label>
      {field.kind === "textarea" ? (
        <textarea
          {...common}
          rows={Math.min(12, Math.max(3, Math.ceil(value.length / 90) + value.split("\n").length))}
        />
      ) : field.kind === "date" ? (
        <input {...common} type="date" />
      ) : (
        <input
          {...common}
          type="text"
          inputMode={field.kind === "url" ? "url" : field.kind === "email" ? "email" : undefined}
          autoComplete="off"
          spellCheck={field.kind === "text"}
        />
      )}
      {field.hint && (
        <p id={hintId} className={ui.hint}>
          {field.hint}
        </p>
      )}
    </div>
  );
}

function ListEditor({
  field,
  items,
  onChange,
}: {
  field: ListField;
  items: Item[];
  onChange: (items: Item[]) => void;
}) {
  const update = (i: number, item: Item) => onChange(items.map((x, j) => (j === i ? item : x)));
  const move = (i: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(i, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  const remove = (i: number) => {
    const label = `${field.itemLabel} ${i + 1}`;
    if (window.confirm(`Remove ${label}?`)) onChange(items.filter((_, j) => j !== i));
  };

  return (
    <fieldset className="rounded-md border border-stone-200 p-3 sm:p-4">
      <legend className="px-1 text-sm font-semibold text-stone-800">{field.label}</legend>
      {field.hint && <p className={ui.hint}>{field.hint}</p>}
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="rounded-md border border-stone-200 bg-stone-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-stone-700">
                {field.itemLabel} {i + 1}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={`${ui.buttonSecondary} px-2 py-1`}
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move ${field.itemLabel} ${i + 1} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={`${ui.buttonSecondary} px-2 py-1`}
                  onClick={() => move(i, i + 1)}
                  disabled={i === items.length - 1}
                  aria-label={`Move ${field.itemLabel} ${i + 1} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={`${ui.buttonDanger} px-2 py-1`}
                  onClick={() => remove(i)}
                  aria-label={`Remove ${field.itemLabel} ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {field.fields.map((sub) => (
                <FieldEditor
                  key={sub.key}
                  field={sub}
                  value={item[sub.key]}
                  onChange={(v) => update(i, { ...item, [sub.key]: v })}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
      {items.length === 0 && <p className="text-sm text-stone-500">None yet.</p>}
      <button
        type="button"
        className={`${ui.buttonSecondary} mt-3`}
        onClick={() => onChange([...items, emptyItem(field.fields)])}
        disabled={items.length >= field.max}
      >
        + Add {field.itemLabel.toLowerCase()}
      </button>
    </fieldset>
  );
}
