import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-200",
  good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  bad: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  // invitation status
  draft: { label: "Draft", tone: "neutral" },
  locked: { label: "Locked", tone: "info" },
  void: { label: "Void", tone: "bad" },
  // QR validation
  passed: { label: "QR valid", tone: "good" },
  failed: { label: "QR failed", tone: "bad" },
  stale: { label: "QR needs revalidation", tone: "warn" },
  not_validated: { label: "QR not validated", tone: "warn" },
  // print status
  not_printed: { label: "Not printed", tone: "neutral" },
  proof_printed: { label: "Proof printed", tone: "info" },
  printed: { label: "Printed", tone: "good" },
  // RSVP
  attending: { label: "Attending", tone: "good" },
  declined: { label: "Declined", tone: "neutral" },
  pending: { label: "Awaiting reply", tone: "warn" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
