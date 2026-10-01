/**
 * Database types for supabase-js.
 *
 * Hand-maintained to mirror supabase/migrations until the CLI is linked.
 * Once linked, regenerate with `npm run db:types` and diff against this file.
 * Keep this file in sync with every migration.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type HouseholdRow = {
  id: string;
  display_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  notes: string | null;
} & Timestamps;

export type GuestRow = {
  id: string;
  household_id: string | null;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  dietary_restrictions: string | null;
  plus_one_allowed: boolean;
  plus_one_of: string | null;
  notes: string | null;
} & Timestamps;

export type EventRow = {
  id: string;
  name: string;
  description: string | null;
  /** Venue-local wall-clock time, e.g. "2027-06-12T16:00:00". */
  starts_at: string | null;
  ends_at: string | null;
  time_zone: string | null;
  location_name: string | null;
  location_address: string | null;
  rsvp_required: boolean;
  meal_selection_required: boolean;
  visibility: Database["public"]["Enums"]["event_visibility"];
  display_order: number;
} & Timestamps;

export type GuestEventRow = { guest_id: string; event_id: string; created_at: string };

export type MealOptionRow = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
} & Timestamps;

export type InvitationRow = {
  id: string;
  household_id: string | null;
  label: string | null;
  token: string;
  rsvp_code: string;
  status: Database["public"]["Enums"]["invitation_status"];
  generated_at: string;
  locked_at: string | null;
  print_status: Database["public"]["Enums"]["print_status"];
  proof_printed_at: string | null;
  printed_at: string | null;
  qr_validation_status: Database["public"]["Enums"]["qr_validation_status"];
  validated_at: string | null;
  validated_url: string | null;
  validation_details: Json | null;
  notes: string | null;
} & Timestamps;

export type InvitationGuestRow = {
  invitation_id: string;
  guest_id: string;
  display_order: number;
  created_at: string;
};

export type RsvpRow = {
  guest_id: string;
  event_id: string;
  status: Database["public"]["Enums"]["rsvp_status"];
  invitation_id: string | null;
  submitted_at: string | null;
} & Timestamps;

export type MealSelectionRow = {
  guest_id: string;
  event_id: string;
  meal_option_id: string;
} & Timestamps;

export type RsvpActivityRow = {
  id: number;
  invitation_id: string;
  activity_type: Database["public"]["Enums"]["rsvp_activity_type"];
  actor: Database["public"]["Enums"]["activity_actor"];
  details: Json;
  occurred_at: string;
};

export type AdminUserRow = { user_id: string; email: string; created_at: string };

/** Insert shape: columns with defaults (and generated values) become optional. */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

type Rel<Name extends string, Cols extends string[], Ref extends string, RefCols extends string[]> = {
  foreignKeyName: Name;
  columns: Cols;
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: RefCols;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13" };
  public: {
    Tables: {
      admin_users: {
        Row: AdminUserRow;
        Insert: InsertOf<AdminUserRow, "user_id" | "email">;
        Update: Partial<AdminUserRow>;
        Relationships: [];
      };
      households: {
        Row: HouseholdRow;
        Insert: InsertOf<HouseholdRow, "display_name">;
        Update: Partial<HouseholdRow>;
        Relationships: [];
      };
      guests: {
        Row: GuestRow;
        Insert: InsertOf<GuestRow, "first_name">;
        Update: Partial<GuestRow>;
        Relationships: [
          Rel<"guests_household_id_fkey", ["household_id"], "households", ["id"]>,
          Rel<"guests_plus_one_of_fkey", ["plus_one_of"], "guests", ["id"]>,
        ];
      };
      events: {
        Row: EventRow;
        Insert: InsertOf<EventRow, "name">;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      guest_events: {
        Row: GuestEventRow;
        Insert: InsertOf<GuestEventRow, "guest_id" | "event_id">;
        Update: Partial<GuestEventRow>;
        Relationships: [
          Rel<"guest_events_guest_id_fkey", ["guest_id"], "guests", ["id"]>,
          Rel<"guest_events_event_id_fkey", ["event_id"], "events", ["id"]>,
        ];
      };
      meal_options: {
        Row: MealOptionRow;
        Insert: InsertOf<MealOptionRow, "event_id" | "name">;
        Update: Partial<MealOptionRow>;
        Relationships: [Rel<"meal_options_event_id_fkey", ["event_id"], "events", ["id"]>];
      };
      invitations: {
        Row: InvitationRow;
        Insert: Partial<InvitationRow>;
        Update: Partial<InvitationRow>;
        Relationships: [Rel<"invitations_household_id_fkey", ["household_id"], "households", ["id"]>];
      };
      invitation_guests: {
        Row: InvitationGuestRow;
        Insert: InsertOf<InvitationGuestRow, "invitation_id" | "guest_id">;
        Update: Partial<InvitationGuestRow>;
        Relationships: [
          Rel<"invitation_guests_invitation_id_fkey", ["invitation_id"], "invitations", ["id"]>,
          Rel<"invitation_guests_guest_id_fkey", ["guest_id"], "guests", ["id"]>,
        ];
      };
      rsvps: {
        Row: RsvpRow;
        Insert: InsertOf<RsvpRow, "guest_id" | "event_id">;
        Update: Partial<RsvpRow>;
        Relationships: [
          Rel<"rsvps_guest_id_fkey", ["guest_id"], "guests", ["id"]>,
          Rel<"rsvps_event_id_fkey", ["event_id"], "events", ["id"]>,
          Rel<"rsvps_invitation_id_fkey", ["invitation_id"], "invitations", ["id"]>,
        ];
      };
      meal_selections: {
        Row: MealSelectionRow;
        Insert: InsertOf<MealSelectionRow, "guest_id" | "event_id" | "meal_option_id">;
        Update: Partial<MealSelectionRow>;
        Relationships: [
          Rel<"meal_selections_guest_id_fkey", ["guest_id"], "guests", ["id"]>,
          Rel<"meal_selections_event_id_fkey", ["event_id"], "events", ["id"]>,
          Rel<"meal_selections_meal_option_fkey", ["event_id", "meal_option_id"], "meal_options", ["event_id", "id"]>,
        ];
      };
      rsvp_activity: {
        Row: RsvpActivityRow;
        // Writes are revoked for API roles; rows come from SECURITY DEFINER functions.
        Insert: InsertOf<RsvpActivityRow, "invitation_id" | "activity_type">;
        Update: Partial<RsvpActivityRow>;
        Relationships: [Rel<"rsvp_activity_invitation_id_fkey", ["invitation_id"], "invitations", ["id"]>];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      get_invitation: { Args: { p_token: string }; Returns: Json };
      record_rsvp_started: { Args: { p_token: string }; Returns: undefined };
      submit_rsvp: { Args: { p_token: string; p_payload: Json }; Returns: Json };
      resolve_rsvp_code: { Args: { p_code: string }; Returns: Json };
      regenerate_invitation_token: { Args: { p_invitation_id: string }; Returns: undefined };
    };
    Enums: {
      invitation_status: "draft" | "locked" | "void";
      print_status: "not_printed" | "proof_printed" | "printed";
      qr_validation_status: "not_validated" | "passed" | "failed";
      rsvp_status: "pending" | "attending" | "declined";
      rsvp_activity_type: "invitation_accessed" | "rsvp_started" | "rsvp_completed" | "rsvp_updated";
      activity_actor: "guest" | "admin";
      event_visibility: "public" | "invited_only";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
