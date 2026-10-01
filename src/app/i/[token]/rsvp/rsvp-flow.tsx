"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { s } from "@/components/site/styles";
import { formatDateOnly, formatTime, formatWeekdayShort } from "@/lib/format";
import { DIETARY_TAGS, describeDietary, type DietaryTag } from "@/lib/rsvp/dietary";
import {
  buildSubmission,
  effectiveAnswer,
  fieldId,
  guestLabel,
  guestsNeedingAnswers,
  hasCompleteResponse,
  initialDraft,
  isGuestAttendingAny,
  mealPairs,
  pairKey,
  rsvpPairs,
  STEP_TITLES,
  stepProblem,
  stepsFor,
  type Answer,
  type RsvpDraft,
  type RsvpStep,
  type StepProblem,
} from "@/lib/rsvp/flow";
import type { InvitationEvent, InvitationView } from "@/lib/rsvp/view";
import { recordRsvpStarted, submitRsvp } from "../actions";

const DRAFT_PREFIX = "bw-rsvp-draft:";

type Done = { result: "rsvp_completed" | "rsvp_updated"; view: InvitationView };

export function RsvpFlow({
  token,
  initialView,
  names,
  monogram,
  contactEmail,
  canEdit,
  startAtReview,
}: {
  token: string;
  initialView: InvitationView;
  names: string;
  monogram: string;
  contactEmail: string;
  canEdit: boolean;
  startAtReview: boolean;
}) {
  const [view, setView] = useState(initialView);
  const [draft, setDraft] = useState<RsvpDraft>(() => initialDraft(initialView));
  const [step, setStep] = useState<RsvpStep>(startAtReview ? "review" : "attendance");
  const [problem, setProblem] = useState<StepProblem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [submitting, startSubmit] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const draftKey = DRAFT_PREFIX + token;

  // Restore an unfinished draft kept on this device; log that the guest started.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { draft: RsvpDraft; step: RsvpStep };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring client-only storage after hydration
        setDraft({ ...initialDraft(initialView), ...parsed.draft });
        if (!startAtReview) setStep(parsed.step);
      }
    } catch {
      /* storage unavailable or corrupt: start fresh */
    }
    if (!hasCompleteResponse(initialView)) void recordRsvpStarted(token);
  }, [draftKey, initialView, startAtReview, token]);

  // Keep answers on the device until Submit.
  useEffect(() => {
    if (done) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ draft, step }));
    } catch {
      /* ignore */
    }
  }, [draft, step, draftKey, done]);

  const steps = stepsFor(view, draft);
  const index = Math.max(0, steps.indexOf(step));

  const update = (fn: (d: RsvpDraft) => void) => {
    setProblem(null);
    setSubmitError(null);
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  function goTo(next: RsvpStep) {
    setProblem(null);
    setSubmitError(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function showProblem(p: StepProblem) {
    setProblem(p);
    if (!p.targetId) return;
    const target = [document.getElementById(p.targetId), document.getElementById(`${p.targetId}-d`)].find(
      (el) => el && el.offsetParent !== null,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
  }

  function next() {
    const p = stepProblem(view, draft, step);
    if (p) return showProblem(p);
    goTo(steps[index + 1]);
  }

  function submit() {
    const built = buildSubmission(view, draft);
    if (!built.ok) {
      if (built.step !== step) goTo(built.step);
      return requestAnimationFrame(() => showProblem(built.problem));
    }
    setSubmitError(null);
    startSubmit(async () => {
      try {
        const result = await submitRsvp(token, built.submission);
        if (!result.ok) {
          setSubmitError(`We couldn't save your RSVP — your answers are still here. ${result.error}`);
          return;
        }
        localStorage.removeItem(draftKey);
        setView(result.view);
        setDraft(initialDraft(result.view));
        setDone({ result: result.result, view: result.view });
        window.scrollTo({ top: 0 });
      } catch {
        setSubmitError(
          "We couldn't save your RSVP — your answers are still here. Check your connection and try again.",
        );
      }
    });
  }

  const deadline = formatDateOnly(view.rsvp_deadline);

  const chrome = (children: ReactNode, opts: { showStepper: boolean }) => (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <header className="border-b border-mist">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-8">
          <Link
            href={`/i/${token}`}
            className="inline-flex min-h-11 items-center rounded border border-dashed border-wisteria px-3 font-serif text-lg text-plum-deep"
          >
            {monogram}
          </Link>
          {opts.showStepper && (
            <Link href={`/i/${token}`} className={s.more}>
              Save &amp; exit
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className={`mx-auto max-w-5xl ${opts.showStepper ? "md:grid md:grid-cols-[13rem_1fr] md:gap-12" : ""}`}>
          {opts.showStepper && <Stepper names={names} steps={steps} index={index} onGo={goTo} />}
          <div className="mx-auto w-full max-w-xl md:mx-0 md:max-w-3xl">{children}</div>
        </div>
      </main>
    </div>
  );

  if (done)
    return chrome(<Confirmation token={token} done={done} names={names} deadline={deadline} />, { showStepper: false });

  if (!canEdit) {
    return chrome(
      <div className="space-y-4 text-center">
        <h1 className={s.h2}>RSVPs are closed</h1>
        <p className="text-muted">
          The deadline has passed. Need a change?{" "}
          <a href={`mailto:${contactEmail}`} className="underline underline-offset-4">
            Contact us
          </a>
          .
        </p>
        <Link href={`/i/${token}`} className={s.btnSecondary}>
          Back to your invitation
        </Link>
      </div>,
      { showStepper: false },
    );
  }

  return chrome(
    <div>
      {/* Mobile step header (component 9) */}
      <div className="mb-6 md:hidden">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => goTo(steps[index - 1])}
            className="inline-flex min-h-11 items-center text-[15px] font-semibold"
          >
            ‹ Back
          </button>
        ) : (
          <Link href={`/i/${token}`} className="inline-flex min-h-11 items-center text-[15px] font-semibold">
            ‹ Back
          </Link>
        )}
        <p className={`${s.label} mt-2`}>
          Step {index + 1} of {steps.length} · {step === "dietary" ? "Optional" : STEP_TITLES[step]}
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-mist" aria-hidden>
          <div
            className="h-1.5 rounded-full bg-plum transition-all"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {step === "attendance" && (
        <StepBody
          ref={headingRef}
          title="Will you be celebrating with us?"
          intro="Answer for each person on your invitation. You'll choose specific events next."
        >
          {guestsNeedingAnswers(view).map((guest) =>
            guest.is_plus_one ? (
              <div key={guest.id} id={fieldId.attendance(guest.id)} className={`${s.card} space-y-3`}>
                <p className="font-semibold">
                  {guest.plus_one_host ? `${guest.plus_one_host}'s guest` : "Your guest"}{" "}
                  <span className={`${s.label} ml-1`}>Plus-one</span>
                </p>
                <ChoicePair
                  label={`${guest.plus_one_host ?? "Your"}'s guest`}
                  value={draft.attendance[guest.id]}
                  yes="Bringing a guest"
                  no="Not this time"
                  onChange={(a) => update((d) => void (d.attendance[guest.id] = a))}
                />
                {draft.attendance[guest.id] === "attending" && (
                  <div id={fieldId.plusOneName(guest.id)} className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium">
                      Their first name
                      <input
                        className={`${s.input} mt-1`}
                        value={draft.plusOneNames[guest.id]?.first ?? ""}
                        maxLength={100}
                        autoComplete="off"
                        onChange={(e) =>
                          update(
                            (d) =>
                              void (d.plusOneNames[guest.id] = { ...d.plusOneNames[guest.id], first: e.target.value }),
                          )
                        }
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Last name (optional)
                      <input
                        className={`${s.input} mt-1`}
                        value={draft.plusOneNames[guest.id]?.last ?? ""}
                        maxLength={100}
                        autoComplete="off"
                        onChange={(e) =>
                          update(
                            (d) =>
                              void (d.plusOneNames[guest.id] = { ...d.plusOneNames[guest.id], last: e.target.value }),
                          )
                        }
                      />
                    </label>
                  </div>
                )}
              </div>
            ) : (
              <div key={guest.id} id={fieldId.attendance(guest.id)} className={`${s.card} space-y-3`}>
                <p className="font-semibold">{[guestLabel(guest), guest.last_name].filter(Boolean).join(" ")}</p>
                <ChoicePair
                  label={guestLabel(guest)}
                  value={draft.attendance[guest.id]}
                  yes="Joyfully accepts"
                  no="Regretfully declines"
                  onChange={(a) => update((d) => void (d.attendance[guest.id] = a))}
                />
              </div>
            ),
          )}
        </StepBody>
      )}

      {step === "events" && (
        <StepBody ref={headingRef} title="Which events will you join?" intro="These are the events you're invited to.">
          <EventsStep view={view} draft={draft} update={update} />
        </StepBody>
      )}

      {step === "meals" && (
        <StepBody ref={headingRef} title="Choose your meal" intro="One choice per person for each dinner.">
          {groupMealPairs(view, draft).map(({ event, pairs }) => (
            <fieldset key={event.id} className="space-y-4">
              <legend className="mb-2 text-sm text-muted">
                Served at the {event.name}
                {event.starts_at ? ` on ${formatWeekdayShort(event.starts_at)}` : ""}.
              </legend>
              {pairs.map((pair) => (
                <fieldset key={pair.key} id={fieldId.meal(pair.key)} className={`${s.card} space-y-2`}>
                  <legend className="px-1 font-semibold">{guestLabel(pair.guest, draft)}</legend>
                  {event.meal_options.map((option) => (
                    <label
                      key={option.id}
                      className="flex min-h-[52px] cursor-pointer items-start gap-3 rounded-lg border-2 border-mist p-3 has-[:checked]:border-plum has-[:checked]:bg-lilac"
                    >
                      <input
                        type="radio"
                        name={pair.key}
                        className="mt-1 h-5 w-5 accent-plum"
                        checked={draft.meals[pair.key] === option.id}
                        onChange={() => update((d) => void (d.meals[pair.key] = option.id))}
                      />
                      <span>
                        <span className="block font-semibold">{option.name}</span>
                        {option.description && <span className="block text-sm text-muted">{option.description}</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </fieldset>
          ))}
        </StepBody>
      )}

      {step === "dietary" && (
        <StepBody ref={headingRef} title="Anything we should know?" intro="Allergies or dietary needs. Skip if none.">
          {view.guests
            .filter((g) => isGuestAttendingAny(view, draft, g.id))
            .map((guest) => {
              const tags = draft.dietaryTags[guest.id] ?? [];
              const toggle = (tag: DietaryTag) =>
                update((d) => {
                  const current = d.dietaryTags[guest.id] ?? [];
                  d.dietaryTags[guest.id] = current.includes(tag)
                    ? current.filter((t) => t !== tag)
                    : [...current, tag];
                });
              return (
                <fieldset key={guest.id} className={`${s.card} space-y-3`}>
                  <legend className="px-1 font-semibold">{guestLabel(guest, draft)}</legend>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      pressed={tags.length === 0}
                      onClick={() => update((d) => void (d.dietaryTags[guest.id] = []))}
                    >
                      None
                    </Chip>
                    {DIETARY_TAGS.map((t) => (
                      <Chip key={t.key} pressed={tags.includes(t.key)} onClick={() => toggle(t.key)}>
                        {t.label}
                      </Chip>
                    ))}
                  </div>
                  <label className="block text-sm font-medium">
                    Details for the caterer (optional)
                    <textarea
                      rows={2}
                      maxLength={500}
                      className={`${s.input} mt-1`}
                      value={draft.dietaryDetails[guest.id] ?? ""}
                      onChange={(e) => update((d) => void (d.dietaryDetails[guest.id] = e.target.value))}
                    />
                  </label>
                </fieldset>
              );
            })}
          <label className="block font-medium">
            A note for the couple (optional)
            <textarea
              rows={3}
              maxLength={1000}
              className={`${s.input} mt-1`}
              value={draft.message}
              onChange={(e) => update((d) => void (d.message = e.target.value))}
            />
          </label>
        </StepBody>
      )}

      {step === "review" && (
        <StepBody ref={headingRef} title="Does everything look right?">
          <Review view={view} draft={draft} steps={steps} onEdit={goTo} />
          <label className="block font-medium">
            Email for your confirmation &amp; updates (optional)
            <input
              type="email"
              autoComplete="email"
              maxLength={254}
              className={`${s.input} mt-1`}
              value={draft.email}
              onChange={(e) => update((d) => void (d.email = e.target.value))}
            />
          </label>
        </StepBody>
      )}

      {problem && (
        <p role="alert" className={`${s.error} mt-6`}>
          <span aria-hidden>! </span>
          {problem.message}
        </p>
      )}
      {submitError && (
        <p role="alert" className={`${s.error} mt-6`}>
          <span aria-hidden>! </span>
          {submitError}
        </p>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {index > 0 ? (
          <button
            type="button"
            onClick={() => goTo(steps[index - 1])}
            className={`${s.btnSecondary} hidden md:inline-flex`}
            disabled={submitting}
          >
            ‹ Back
          </button>
        ) : (
          <span className="hidden md:block" />
        )}
        {step === "review" ? (
          <button type="button" onClick={submit} className={`${s.btn} w-full sm:w-auto`} disabled={submitting}>
            {submitting ? "Sending…" : "Submit RSVP"}
          </button>
        ) : (
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {step === "dietary" && (
              <button type="button" onClick={() => goTo("review")} className={s.btnSecondary}>
                Skip
              </button>
            )}
            <button type="button" onClick={next} className={`${s.btn} w-full sm:w-auto`}>
              Continue
            </button>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-sm text-muted sm:text-left">
        {step === "review"
          ? deadline
            ? `You can change this until ${deadline}.`
            : "You can change this later using the same link."
          : "Nothing is sent until you review."}
      </p>
    </div>,
    { showStepper: true },
  );
}

// ---------------------------------------------------------------------------

function StepBody({
  ref,
  title,
  intro,
  children,
}: {
  ref: React.Ref<HTMLHeadingElement>;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h1 ref={ref} tabIndex={-1} className="font-serif text-3xl leading-tight text-ink outline-none sm:text-4xl">
          {title}
        </h1>
        {intro && <p className="text-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

/** Desktop vertical stepper (component 30). */
function Stepper({
  names,
  steps,
  index,
  onGo,
}: {
  names: string;
  steps: RsvpStep[];
  index: number;
  onGo: (s: RsvpStep) => void;
}) {
  return (
    <nav aria-label="RSVP steps" className="hidden md:block">
      <p className={`${s.label} mb-4`}>RSVP · {names}</p>
      <ol className="space-y-1">
        {steps.map((st, i) => {
          const complete = i < index;
          const current = i === index;
          return (
            <li key={st}>
              <button
                type="button"
                disabled={!complete}
                onClick={() => onGo(st)}
                aria-current={current ? "step" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left ${current ? "bg-lilac font-semibold" : ""} ${complete ? "hover:bg-lilac" : ""}`}
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm ${complete ? "border-plum bg-plum text-white" : current ? "border-plum text-plum" : "border-mist text-muted"}`}
                >
                  {complete ? "✓" : i + 1}
                </span>
                <span>
                  {STEP_TITLES[st]}
                  {st === "dietary" && <span className="text-muted"> (optional)</span>}
                  {complete && <span className="sr-only"> (completed)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Component 11: Yes/No toggle as aria-pressed buttons with a check mark (never color alone). */
function ChoicePair({
  label,
  value,
  yes,
  no,
  onChange,
  compact = false,
}: {
  label: string;
  value: Answer | undefined;
  yes: string;
  no: string;
  onChange: (a: Answer) => void;
  compact?: boolean;
}) {
  const option = (answer: Answer, text: string, mark: string) => (
    <button
      type="button"
      aria-pressed={value === answer}
      onClick={() => onChange(answer)}
      className={`flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border-2 px-3 text-sm font-semibold transition-colors ${
        value === answer ? "border-plum bg-plum text-white" : "border-wisteria bg-white text-ink hover:bg-lilac"
      } ${compact ? "min-w-16" : "min-h-[52px]"}`}
    >
      {value === answer && <span aria-hidden>{mark}</span>}
      {text}
    </button>
  );
  return (
    <div role="group" aria-label={label} className="flex gap-2">
      {option("attending", yes, "✓")}
      {option("declined", no, "✕")}
    </div>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1 rounded-full border-2 px-4 text-sm font-medium ${
        pressed ? "border-plum bg-plum text-white" : "border-wisteria bg-white text-ink hover:bg-lilac"
      }`}
    >
      {pressed && <span aria-hidden>✓</span>}
      {children}
    </button>
  );
}

function eventLine(event: InvitationEvent): string {
  return [formatWeekdayShort(event.starts_at), formatTime(event.starts_at), event.location_name]
    .filter(Boolean)
    .join(" · ");
}

/** Step 2. Mobile: per event, one row per invited guest. Desktop: guest × event grid. */
function EventsStep({
  view,
  draft,
  update,
}: {
  view: InvitationView;
  draft: RsvpDraft;
  update: (fn: (d: RsvpDraft) => void) => void;
}) {
  const accepted = guestsNeedingAnswers(view).filter((g) => draft.attendance[g.id] === "attending");
  const events = view.events.filter((e) => e.rsvp_required && accepted.some((g) => e.guest_ids.includes(g.id)));
  const set = (key: ReturnType<typeof pairKey>, a: Answer) => update((d) => void (d.events[key] = a));

  return (
    <>
      <div className="space-y-4 md:hidden">
        {events.map((event) => (
          <div key={event.id} className={`${s.card} space-y-3`}>
            <div>
              <p className="font-semibold">{event.name}</p>
              <p className="text-sm text-muted">{eventLine(event)}</p>
            </div>
            {accepted
              .filter((g) => event.guest_ids.includes(g.id))
              .map((guest) => {
                const key = pairKey(guest.id, event.id);
                return (
                  <div key={key} id={fieldId.event(key)} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm font-medium">{guestLabel(guest, draft)}</span>
                    <ChoicePair
                      compact
                      label={`${guestLabel(guest, draft)} at the ${event.name}`}
                      value={draft.events[key]}
                      yes="Yes"
                      no="No"
                      onChange={(a) => set(key, a)}
                    />
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-y-2 text-left text-sm">
          <thead>
            <tr>
              <th scope="col" className="pb-1 font-medium text-muted">
                Event
              </th>
              {accepted.map((g) => (
                <th key={g.id} scope="col" className="pb-1 font-medium text-muted">
                  {guestLabel(g, draft)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="align-middle">
                <th
                  scope="row"
                  className="rounded-l-lg border-y border-l border-mist bg-white py-3 pr-4 pl-4 font-normal"
                >
                  <span className="block font-semibold">{event.name}</span>
                  <span className="text-muted">{eventLine(event)}</span>
                </th>
                {accepted.map((guest, i) => {
                  const key = pairKey(guest.id, event.id);
                  const last = i === accepted.length - 1;
                  return (
                    <td
                      key={key}
                      id={`${fieldId.event(key)}-d`}
                      className={`border-y border-mist bg-white px-2 py-3 ${last ? "rounded-r-lg border-r" : ""}`}
                    >
                      {event.guest_ids.includes(guest.id) ? (
                        <ChoicePair
                          compact
                          label={`${guestLabel(guest, draft)} at the ${event.name}`}
                          value={draft.events[key]}
                          yes="Yes"
                          no="No"
                          onChange={(a) => set(key, a)}
                        />
                      ) : (
                        <span className="text-muted">Not invited</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function groupMealPairs(view: InvitationView, draft: RsvpDraft) {
  const groups: { event: InvitationEvent; pairs: ReturnType<typeof mealPairs> }[] = [];
  for (const pair of mealPairs(view, draft)) {
    const group = groups.find((g) => g.event.id === pair.event.id);
    if (group) group.pairs.push(pair);
    else groups.push({ event: pair.event, pairs: [pair] });
  }
  return groups;
}

/** Review (screen 08): titled sections, each with Edit. */
function Review({
  view,
  draft,
  steps,
  onEdit,
}: {
  view: InvitationView;
  draft: RsvpDraft;
  steps: RsvpStep[];
  onEdit: (s: RsvpStep) => void;
}) {
  const pairs = rsvpPairs(view);
  const guests = guestsNeedingAnswers(view);
  const eventsWithAnswers = view.events.filter((e) => e.rsvp_required && pairs.some((p) => p.event.id === e.id));
  const meals = mealPairs(view, draft);
  const dietary = view.guests
    .filter((g) => isGuestAttendingAny(view, draft, g.id))
    .map((g) => ({
      name: guestLabel(g, draft),
      text: describeDietary(draft.dietaryTags[g.id] ?? [], draft.dietaryDetails[g.id]),
    }))
    .filter((d) => d.text);

  const section = (title: string, target: RsvpStep, body: ReactNode) => (
    <section className={`${s.card} space-y-2`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {steps.includes(target) && (
          <button type="button" onClick={() => onEdit(target)} className={`${s.more} text-sm`}>
            Edit<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        )}
      </div>
      {body}
    </section>
  );

  return (
    <div className="space-y-4">
      {section(
        "Guests",
        "attendance",
        <ul className="space-y-1 text-sm">
          {guests.map((g) => {
            const a = draft.attendance[g.id];
            const name = g.is_plus_one ? guestLabel(g, draft) : [guestLabel(g), g.last_name].filter(Boolean).join(" ");
            return (
              <li key={g.id} className="flex justify-between gap-3">
                <span>{name}</span>
                <span className={a === "attending" ? "text-sage" : "text-muted"}>
                  {g.is_plus_one
                    ? a === "attending"
                      ? "✓ Bringing"
                      : "Not bringing"
                    : a === "attending"
                      ? "✓ Attending"
                      : "✕ Not attending"}
                </span>
              </li>
            );
          })}
        </ul>,
      )}
      {steps.includes("events") &&
        section(
          "Events",
          "events",
          <ul className="space-y-1 text-sm">
            {eventsWithAnswers.map((e) => {
              const evPairs = pairs.filter((p) => p.event.id === e.id);
              const yes = evPairs
                .filter((p) => effectiveAnswer(draft, p) === "attending")
                .map((p) => guestLabel(p.guest, draft));
              return (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>
                    {e.name} · {formatWeekdayShort(e.starts_at)}
                  </span>
                  <span className={yes.length ? "text-ink" : "text-muted"}>
                    {yes.length ? yes.join(", ") : "✕ Not attending"}
                  </span>
                </li>
              );
            })}
          </ul>,
        )}
      {meals.length > 0 &&
        section(
          "Dinner",
          "meals",
          <ul className="space-y-1 text-sm">
            {meals.map((p) => (
              <li key={p.key} className="flex justify-between gap-3">
                <span>{guestLabel(p.guest, draft)}</span>
                <span>{p.event.meal_options.find((m) => m.id === draft.meals[p.key])?.name ?? "—"}</span>
              </li>
            ))}
          </ul>,
        )}
      {steps.includes("dietary") &&
        section(
          "Dietary",
          "dietary",
          <div className="space-y-1 text-sm">
            {dietary.length === 0 ? (
              <p className="text-muted">No dietary needs.</p>
            ) : (
              dietary.map((d) => (
                <p key={d.name}>
                  {d.name} — {d.text}
                </p>
              ))
            )}
            {draft.message.trim() && <p className="text-muted">Note: “{draft.message.trim()}”</p>}
          </div>,
        )}
    </div>
  );
}

/** Confirmation (screen 09), with the decline-all variant. */
function Confirmation({
  token,
  done,
  names,
  deadline,
}: {
  token: string;
  done: Done;
  names: string;
  deadline: string | null;
}) {
  const draft = initialDraft(done.view);
  const pairs = rsvpPairs(done.view);
  const attendingGuests = done.view.guests.filter((g) => isGuestAttendingAny(done.view, draft, g.id)).length;
  const attendingEvents = new Set(pairs.filter((p) => effectiveAnswer(draft, p) === "attending").map((p) => p.event.id))
    .size;
  const missed = attendingGuests === 0;

  return (
    <section aria-live="polite" className="space-y-5 text-center">
      <h1 className={s.h1}>
        {missed ? "We'll miss you" : done.result === "rsvp_updated" ? "Your changes are saved" : "You're all set!"}
      </h1>
      <p className="text-lg">
        {missed
          ? `Thank you for letting us know, ${names}. You'll be in our thoughts.`
          : `We can't wait to celebrate with you, ${names}.`}
      </p>
      {!missed && (
        <p className="text-muted">
          {attendingGuests} attending · {attendingEvents} {attendingEvents === 1 ? "event" : "events"}
        </p>
      )}
      <p className="text-sm text-muted">
        Your invitation link always brings you back here.{deadline ? ` You can make changes until ${deadline}.` : ""}
      </p>
      <div className="mx-auto flex max-w-sm flex-col gap-3">
        <Link href={`/i/${token}`} className={s.btn}>
          {missed ? "Back to your invitation" : "View your wedding weekend"}
        </Link>
        {missed ? (
          <Link href="/registry" className={s.btnSecondary}>
            See our registry
          </Link>
        ) : (
          <a href={`/i/${token}/calendar.ics`} className={s.btnSecondary}>
            Add events to calendar
          </a>
        )}
        <Link href={`/i/${token}/rsvp?step=review`} className={s.more + " justify-center"}>
          Edit RSVP
        </Link>
      </div>
    </section>
  );
}
