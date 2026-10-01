/**
 * Shape of the guest-safe invitation view returned by public.get_invitation()
 * and public.submit_rsvp(). Parsed at the boundary so the UI never trusts
 * unvalidated JSON.
 */
import { z } from "zod";

const id = z.string().min(1);

export const invitationGuestSchema = z.object({
  id,
  first_name: z.string(),
  last_name: z.string().nullable(),
  display_name: z.string().nullable(),
  dietary_restrictions: z.string().nullable(),
});

export const mealOptionSchema = z.object({
  id,
  name: z.string(),
  description: z.string().nullable(),
});

export const invitationEventSchema = z.object({
  id,
  name: z.string(),
  description: z.string().nullable(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  time_zone: z.string().nullable(),
  location_name: z.string().nullable(),
  location_address: z.string().nullable(),
  rsvp_required: z.boolean(),
  meal_selection_required: z.boolean(),
  guest_ids: z.array(id),
  meal_options: z.array(mealOptionSchema),
});

export const invitationResponseSchema = z.object({
  guest_id: id,
  event_id: id,
  status: z.enum(["pending", "attending", "declined"]),
  meal_option_id: id.nullable(),
  updated_at: z.string(),
});

export const invitationViewSchema = z.object({
  guests: z.array(invitationGuestSchema),
  events: z.array(invitationEventSchema),
  responses: z.array(invitationResponseSchema),
});

export const submitResultSchema = z.object({
  result: z.enum(["rsvp_completed", "rsvp_updated"]),
  invitation: invitationViewSchema,
});

export type InvitationGuest = z.infer<typeof invitationGuestSchema>;
export type InvitationEvent = z.infer<typeof invitationEventSchema>;
export type InvitationResponse = z.infer<typeof invitationResponseSchema>;
export type InvitationView = z.infer<typeof invitationViewSchema>;
