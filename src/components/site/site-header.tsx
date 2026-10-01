"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { s } from "@/components/site/styles";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Site navigation (component 1): desktop shows the links + RSVP; mobile shows
 * the monogram, RSVP, and a menu sheet.
 */
export function SiteHeader({
  monogram,
  items,
  rsvpHref,
  rsvpLabel = "RSVP",
  homeHref = "/",
}: {
  monogram: string;
  items: NavItem[];
  rsvpHref: string;
  rsvpLabel?: string;
  homeHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-mist bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-8">
        <Link
          href={homeHref}
          className="inline-flex min-h-11 items-center rounded border border-dashed border-wisteria px-3 font-serif text-lg text-plum-deep"
          aria-label={`${monogram} — home`}
        >
          {monogram}
        </Link>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-[15px] text-ink hover:bg-lilac"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href={rsvpHref} className={`${s.btnSmall} ml-auto lg:ml-2`}>
          {rsvpLabel}
        </Link>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink hover:bg-lilac lg:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          <span aria-hidden className="text-2xl leading-none">
            {open ? "×" : "≡"}
          </span>
        </button>
      </div>
      {open && (
        <nav id={menuId} aria-label="Main" className="border-t border-mist bg-white px-4 pb-4 lg:hidden">
          <ul>
            {items.map((item) => (
              <li key={item.href} className="border-b border-mist">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[52px] items-center text-lg text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
