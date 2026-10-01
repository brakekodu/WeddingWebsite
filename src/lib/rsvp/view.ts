/**
 * Shapes of the guest-safe data returned by public.get_invitation(),
 * public.submit_rsvp(), and public.get_public_site(). Parsed at the boundary
 * so the UI never trusts unvalidated JSON.
 */
import { z } from "zod";

const id = z.string().min(1);

export const invitationGuestSchema = z.object({
  id,
  first_name: z.string(),
  last_name: z.string().nullable(),
  display_name: z.string().nullable(),
  dietary_restrictions: z.string().nullable(),
  dietary_tags: z.array(z.string()).default([]),
  is_plus_one: z.boolean().default(false),
  plus_one_host: z.string().nullable().default(null),
});

export const mealOptionSchema = z.object({
  id,
  name: z.string(),
  description: z.string().nullable(),
});

const eventFields = {
  id,
  name: z.string(),
  description: z.string().nullable(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  time_zone: z.string().nullable(),
  location_name: z.string().nullable(),
  location_address: z.string().nullable(),
  attire: z.string().nullable().default(null),
  guest_notes: z.string().nullable().default(null),
};

export const invitationEventSchema = z.object({
  ...eventFields,
  rsvp_required: z.boolean(),
  meal_selection_required: z.boolean(),
  guest_ids: z
    .array(id)
    .nullable()
    .transform((v) => v ?? []),
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
  contact_email: z.string().nullable().default(null),
  guest_message: z.string().nullable().default(null),
  rsvp_deadline: z.string().nullable().default(null),
  rsvp_open: z.boolean().default(true),
});

export const submitResultSchema = z.object({
  result: z.enum(["rsvp_completed", "rsvp_updated"]),
  invitation: invitationViewSchema,
});

export const publicEventSchema = z.object(eventFields);

export const publicSiteSchema = z.object({
  events: z.array(publicEventSchema),
  rsvp_deadline: z.string().nullable(),
});

export type InvitationGuest = z.infer<typeof invitationGuestSchema>;
export type InvitationEvent = z.infer<typeof invitationEventSchema>;
export type InvitationResponse = z.infer<typeof invitationResponseSchema>;
export type InvitationView = z.infer<typeof invitationViewSchema>;
export type PublicEvent = z.infer<typeof publicEventSchema>;
export type PublicSite = z.infer<typeof publicSiteSchema>;
/** The fields shared by public and personalized event cards. */
export type DisplayEvent = PublicEvent;
