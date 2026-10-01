/** Maps machine-readable errors raised by public.submit_rsvp() to guest-facing text. */
const MESSAGES: Record<string, string> = {
  invitation_not_found: "We couldn't find this invitation. Please check your link or RSVP code.",
  response_incomplete: "Please answer for everyone before submitting.",
  response_not_allowed: "Something on this form doesn't match your invitation. Please reload and try again.",
  meal_required: "Please choose a meal for each person attending.",
  invalid_meal: "One of the meal choices is no longer available. Please reload and choose again.",
  invalid_payload: "Something went wrong with the form. Please reload and try again.",
};

const FALLBACK = "We couldn't save your RSVP just now. Please try again in a moment.";

export function rsvpErrorMessage(dbMessage: string | undefined | null): string {
  if (!dbMessage) return FALLBACK;
  const code = Object.keys(MESSAGES).find((key) => dbMessage.includes(key));
  return code ? MESSAGES[code] : FALLBACK;
}
