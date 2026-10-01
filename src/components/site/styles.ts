/** Shared class strings for the guest-facing site (palette tokens in globals.css). */
export const s = {
  btn: "inline-flex min-h-[52px] items-center justify-center rounded-lg border-2 border-plum bg-plum px-6 text-base font-semibold text-white transition-colors hover:border-plum-hover hover:bg-plum-hover disabled:cursor-not-allowed disabled:opacity-60",
  btnSecondary:
    "inline-flex min-h-[52px] items-center justify-center rounded-lg border-2 border-plum bg-white px-6 text-base font-semibold text-plum transition-colors hover:bg-lilac disabled:cursor-not-allowed disabled:opacity-60",
  btnSmall:
    "inline-flex min-h-11 items-center justify-center rounded-lg border-2 border-plum bg-plum px-4 text-sm font-semibold text-white hover:border-plum-hover hover:bg-plum-hover",
  more: "inline-flex min-h-11 items-center text-[15px] font-semibold text-ink underline decoration-wisteria underline-offset-4 hover:decoration-plum",
  label: "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted",
  h1: "font-serif text-4xl leading-tight text-ink sm:text-5xl",
  h2: "font-serif text-3xl leading-tight text-ink sm:text-4xl",
  h3: "text-lg font-semibold text-ink",
  body: "text-base leading-relaxed text-ink",
  muted: "text-muted",
  card: "rounded-xl border border-mist bg-white p-5",
  section: "border-t border-mist px-5 py-12 sm:px-8 sm:py-20",
  container: "mx-auto w-full max-w-5xl",
  input:
    "w-full rounded-lg border-2 border-wisteria bg-white px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-plum focus:outline-none",
  error: "rounded-lg border border-error/30 bg-[#fbeeee] p-3 text-sm text-error",
} as const;
