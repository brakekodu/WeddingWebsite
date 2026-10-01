/** Shared Tailwind class strings for the functional admin UI. */
export const ui = {
  input:
    "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:bg-stone-100",
  label: "mb-1 block text-sm font-medium text-stone-700",
  hint: "mt-1 text-xs text-stone-500",
  button:
    "inline-flex items-center justify-center gap-2 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50",
  buttonSecondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50",
  buttonDanger:
    "inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50",
  card: "rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:p-6",
  h1: "text-2xl font-semibold tracking-tight text-stone-900",
  h2: "text-lg font-semibold text-stone-900",
  table: "min-w-full divide-y divide-stone-200 text-sm",
  th: "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500",
  td: "px-3 py-2 align-top text-stone-800",
  link: "font-medium text-stone-900 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-900",
} as const;
