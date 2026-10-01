"use client";

import { useId, useState } from "react";

/** Component 6: FAQ accordion — buttons with aria-expanded. */
export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const baseId = useId();
  return (
    <div className="border-t border-mist">
      {items.map((item, i) => {
        const expanded = open === i;
        const panelId = `${baseId}-${i}`;
        return (
          <div key={item.q} className="border-b border-mist">
            <h3>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : i)}
                className="flex min-h-[52px] w-full items-center justify-between gap-4 py-2 text-left text-[15px] font-medium text-ink"
              >
                {item.q}
                <span aria-hidden className="text-xl text-plum">
                  {expanded ? "−" : "+"}
                </span>
              </button>
            </h3>
            <div id={panelId} hidden={!expanded} className="pb-4 text-[15px] leading-relaxed text-muted">
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
