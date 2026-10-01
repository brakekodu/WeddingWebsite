"use client";

import { useState, useTransition } from "react";
import { formatEventDate, formatEventTimeRange } from "@/lib/format";
import { formatGreeting, greetingName } from "@/lib/invitations/greeting";
import {
  buildSubmission,
  effectiveAnswer,
  guestsNeedingAnswers,
  hasCompleteResponse,
  initialDraft,
  isGuestAttendingAny,
  mealPairs,
  pairKey,
  rsvpPairs,
  stepProblem,
  stepsFor,
  type Answer,
  type RsvpDraft,
  type RsvpStep,
} from "@/lib/rsvp/flow";
import type { InvitationEvent, InvitationView } from "@/lib/rsvp/view";
import { recordRsvpStarted, submitRsvp } from "./actions";

export function RsvpExperience({ token, initialView }: { token: string; initialView: InvitationView }) {
  const [view, setView] = useState(initialView);
  const [draft, setDraft] = useState<RsvpDraft>(() => initialDraft(initialView));
  const [step, setStep] = useState<RsvpStep>("welcome");
  const [done, setDone] = useState<null | "rsvp_completed" | "rsvp_updated">(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const steps = stepsFor(view, draft);
  const index = Math.max(0, steps.indexOf(step));
  const hasRsvpEvents = rsvpPairs(view).length > 0;

  function goTo(next: RsvpStep) {
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function next() {
    const problem = stepProblem(view, draft, step);
    if (problem) return setError(problem);
    if (step === "welcome") void recordRsvpStarted(token);
    goTo(steps[index + 1]);
  }

  function submit() {
    const built = buildSubmission(view, draft);
    if (!built.ok) return setError(built.error);
    setError(null);
    startSubmit(async () => {
      const result = await submitRsvp(token, built.submission);
      if (!result.ok) return setError(result.error);
      setView(result.view);
      setDraft(initialDraft(result.view));
      setDone(result.result);
      setStep("welcome");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const update = (fn: (d: RsvpDraft) => void) => {
    setError(null);
    setDraft((prev) => {
      const copy: RsvpDraft = {
        guestAttendance: { ...prev.guestAttendance },
        eventAttendance: { ...prev.eventAttendance },
        meals: { ...prev.meals },
        dietary: { ...prev.dietary },
      };
      fn(copy);
      return copy;
    });
  };

  if (done) {
    const allDeclined = !view.guests.some((g) => isGuestAttendingAny(view, initialDraft(view), g.id));
    return (
      <section aria-live="polite" className="text-center">
        <h1 className="font-serif text-4xl text-stone-900 sm:text-5xl">
          {done === "rsvp_updated" ? "Your RSVP has been updated" : "Thank you!"}
        </h1>
        <p className="mt-4 text-stone-600">
          {allDeclined
            ? "We'll miss you, and we're grateful you let us know."
            : "Your response has been saved. We can't wait to celebrate with you."}
        </p>
        <SavedSummary view={view} />
        <p className="mt-8 text-sm text-stone-600">You can change your response anytime using this same link.</p>
        <button type="button" className={`${secondaryButton} mt-4`} onClick={() => setDone(null)}>
          Review or change my RSVP
        </button>
      </section>
    );
  }

  return (
    <div>
      {step !== "welcome" && (
        <p className="mb-6 text-center text-xs tracking-[0.2em] text-stone-500 uppercase">
          Step {index} of {steps.length - 1}
        </p>
      )}

      {step === "welcome" && (
        <section className="text-center">
          <h1 className="font-serif text-4xl text-stone-900 sm:text-5xl">{formatGreeting(view.guests)}</h1>
          <p className="mt-4 text-lg text-stone-600">We&apos;re so excited to celebrate with you.</p>

          {view.events.length > 0 && (
            <div className="mt-10 space-y-4 text-left">
              <h2 className="text-center text-xs tracking-[0.2em] text-stone-500 uppercase">You&apos;re invited to</h2>
              {view.events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}

          {hasRsvpEvents && hasCompleteResponse(view) && (
            <div className="mt-10">
              <p className="font-medium text-stone-800">Thank you — we have your RSVP.</p>
              <SavedSummary view={view} />
            </div>
          )}

          {hasRsvpEvents && (
            <button type="button" className={`${primaryButton} mt-10`} onClick={next}>
              {hasCompleteResponse(view) ? "Update RSVP" : "Begin RSVP"}
            </button>
          )}
        </section>
      )}

      {step === "attendance" && (
        <StepShell title="Will you be joining us?">
          {guestsNeedingAnswers(view).map((guest) => (
            <ChoiceRow
              key={guest.id}
              label={greetingName(guest)}
              value={draft.guestAttendance[guest.id]}
              onChange={(answer) =>
                update((d) => {
                  d.guestAttendance[guest.id] = answer;
                })
              }
            />
          ))}
        </StepShell>
      )}

      {step === "events" && (
        <StepShell title="Which events can you attend?">
          {view.events
            .filter((e) => e.rsvp_required)
            .map((event) => {
              const guests = view.guests.filter(
                (g) => event.guest_ids.includes(g.id) && draft.guestAttendance[g.id] === "attending",
              );
              if (guests.length === 0) return null;
              return (
                <fieldset key={event.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <legend className="px-1 font-serif text-2xl text-stone-900">{event.name}</legend>
                  <EventWhen event={event} />
                  <div className="mt-3 space-y-3">
                    {guests.map((guest) => {
                      const key = pairKey(guest.id, event.id);
                      return (
                        <ChoiceRow
                          key={key}
                          label={greetingName(guest)}
                          value={draft.eventAttendance[key] ?? "attending"}
                          onChange={(answer) =>
                            update((d) => {
                              d.eventAttendance[key] = answer;
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
        </StepShell>
      )}

      {step === "meals" && (
        <StepShell title="Choose your meal">
          {mealPairs(view, draft).map((pair) => (
            <fieldset key={pair.key} className="rounded-xl border border-stone-200 bg-white p-4">
              <legend className="px-1 font-medium text-stone-900">
                {greetingName(pair.guest)} <span className="font-normal text-stone-500">· {pair.event.name}</span>
              </legend>
              <div className="mt-2 space-y-2">
                {pair.event.meal_options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 has-[:checked]:border-stone-900 has-[:checked]:bg-stone-50"
                  >
                    <input
                      type="radio"
                      name={pair.key}
                      className="mt-1"
                      checked={draft.meals[pair.key] === option.id}
                      onChange={() =>
                        update((d) => {
                          d.meals[pair.key] = option.id;
                        })
                      }
                    />
                    <span>
                      <span className="block font-medium text-stone-900">{option.name}</span>
                      {option.description && <span className="block text-sm text-stone-600">{option.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </StepShell>
      )}

      {step === "dietary" && (
        <StepShell title="Any dietary restrictions?">
          <p className="text-sm text-stone-600">
            Allergies or dietary needs we should share with the caterer. Optional.
          </p>
          {view.guests
            .filter((g) => isGuestAttendingAny(view, draft, g.id))
            .map((guest) => (
              <label key={guest.id} className="block">
                <span className="mb-1 block font-medium text-stone-900">{greetingName(guest)}</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={draft.dietary[guest.id] ?? ""}
                  onChange={(e) =>
                    update((d) => {
                      d.dietary[guest.id] = e.target.value;
                    })
                  }
                  className="w-full rounded-lg border border-stone-300 bg-white p-3 text-stone-900 focus:border-stone-600 focus:outline-none"
                  placeholder="e.g. vegetarian, nut allergy"
                />
              </label>
            ))}
        </StepShell>
      )}

      {step === "review" && (
        <StepShell title="Review your RSVP">
          <DraftSummary view={view} draft={draft} />
        </StepShell>
      )}

      {error && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 p-3 text-center text-sm text-red-800">
          {error}
        </p>
      )}

      {step !== "welcome" && (
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => goTo(steps[index - 1])}
            disabled={submitting}
          >
            Back
          </button>
          {step === "review" ? (
            <button type="button" className={primaryButton} onClick={submit} disabled={submitting}>
              {submitting ? "Saving…" : "Submit RSVP"}
            </button>
          ) : (
            <button type="button" className={primaryButton} onClick={next}>
              Continue
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const primaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-stone-900 px-8 text-base font-medium text-white hover:bg-stone-700 disabled:opacity-50";
const secondaryButton =
  "inline-flex min-h-12 items-center justify-center rounded-full border border-stone-300 px-6 text-base text-stone-800 hover:bg-white disabled:opacity-50";

function StepShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="mb-6 text-center font-serif text-3xl text-stone-900 sm:text-4xl">{title}</h1>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ChoiceRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Answer | undefined;
  onChange: (answer: Answer) => void;
}) {
  const option = (answer: Answer, text: string) => (
    <button
      type="button"
      aria-pressed={value === answer}
      onClick={() => onChange(answer)}
      className={`min-h-12 flex-1 rounded-lg border px-3 text-sm font-medium transition ${
        value === answer
          ? "border-stone-900 bg-stone-900 text-white"
          : "border-stone-300 bg-white text-stone-800 hover:border-stone-500"
      }`}
    >
      {text}
    </button>
  );
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4" role="group" aria-label={label}>
      <p className="mb-3 font-medium text-stone-900">{label}</p>
      <div className="flex gap-2">
        {option("attending", "Joyfully accepts")}
        {option("declined", "Regretfully declines")}
      </div>
    </div>
  );
}

function EventWhen({ event }: { event: InvitationEvent }) {
  const date = formatEventDate(event.starts_at);
  const time = formatEventTimeRange(event.starts_at, event.ends_at);
  if (!date && !event.location_name) return null;
  return (
    <p className="text-sm text-stone-600">
      {[date, time].filter(Boolean).join(" · ")}
      {event.location_name && <span className="block">{event.location_name}</span>}
    </p>
  );
}

function EventCard({ event }: { event: InvitationEvent }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="font-serif text-2xl text-stone-900">{event.name}</p>
      <EventWhen event={event} />
      {event.location_address && <p className="text-sm text-stone-500">{event.location_address}</p>}
      {event.description && <p className="mt-2 text-sm text-stone-700">{event.description}</p>}
      {!event.rsvp_required && <p className="mt-2 text-xs text-stone-500">No RSVP needed.</p>}
    </div>
  );
}

type SummaryRow = {
  id: string;
  name: string;
  items: { event: string; answer: Answer | undefined; meal?: string }[];
  dietary?: string;
};

function SummaryList({ rows }: { rows: SummaryRow[] }) {
  return (
    <ul className="mt-4 space-y-3 text-left">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="font-medium text-stone-900">{row.name}</p>
          <ul className="mt-1 space-y-1 text-sm text-stone-700">
            {row.items.map((item) => (
              <li key={item.event}>
                {item.event}:{" "}
                <span className={item.answer === "attending" ? "text-emerald-700" : "text-stone-500"}>
                  {item.answer === "attending"
                    ? "Attending"
                    : item.answer === "declined"
                      ? "Not attending"
                      : "No answer"}
                </span>
                {item.meal && <span className="text-stone-500"> · {item.meal}</span>}
              </li>
            ))}
          </ul>
          {row.dietary && <p className="mt-1 text-sm text-stone-500">Dietary: {row.dietary}</p>}
        </li>
      ))}
    </ul>
  );
}

function summarize(view: InvitationView, draft: RsvpDraft): SummaryRow[] {
  const pairs = rsvpPairs(view);
  return guestsNeedingAnswers(view).map((guest) => {
    const attending = isGuestAttendingAny(view, draft, guest.id);
    return {
      id: guest.id,
      name: greetingName(guest),
      items: pairs
        .filter((p) => p.guest.id === guest.id)
        .map((p) => {
          const answer = effectiveAnswer(draft, p);
          const mealId = answer === "attending" ? draft.meals[p.key] : undefined;
          return {
            event: p.event.name,
            answer,
            meal: p.event.meal_options.find((m) => m.id === mealId)?.name,
          };
        }),
      dietary: attending ? draft.dietary[guest.id]?.trim() || undefined : undefined,
    };
  });
}

function DraftSummary({ view, draft }: { view: InvitationView; draft: RsvpDraft }) {
  return <SummaryList rows={summarize(view, draft)} />;
}

function SavedSummary({ view }: { view: InvitationView }) {
  return <SummaryList rows={summarize(view, initialDraft(view))} />;
}
