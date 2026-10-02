-- =====================================================================
-- Website photos managed from the admin (Admin → Photos)
-- =====================================================================
-- Image files live in the R2 bucket `brake-wedding` (under site/); these
-- tables record which photo goes in which spot on the site and how it is
-- cropped. The bundled engagement photos (public/photos) are referenced as
-- 'bundled:<id>' and need no row here.
--
-- Admins manage both tables through RLS. The public site reads them only
-- through get_site_media(), which returns display data (no admin fields).

create table public.site_photos (
  id uuid primary key default gen_random_uuid(),
  -- R2 key prefix, e.g. site/photos/<id>; renditions are <prefix>/full-<w>.<ext>
  storage_prefix text not null unique check (storage_prefix ~ '^site/photos/[0-9a-f-]{36}$'),
  format text not null check (format in ('webp', 'jpg')),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  widths integer[] not null check (cardinality(widths) between 1 and 6),
  alt text not null default '' check (length(alt) <= 300),
  original_name text check (original_name is null or length(original_name) <= 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger site_photos_set_updated_at
  before update on public.site_photos
  for each row execute function private.set_updated_at();

alter table public.site_photos enable row level security;

create policy "Admins manage site_photos"
  on public.site_photos for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.site_photos from anon;

create table public.site_placements (
  id uuid primary key default gen_random_uuid(),
  -- A spot on the site, e.g. home.hero, home.strip, gallery (see src/lib/media/slots.ts).
  slot text not null check (slot ~ '^[a-z]+(\.[a-z_]+)*$'),
  position integer not null default 0 check (position between 0 and 499),
  -- 'bundled:<id>' or the uuid of a site_photos row.
  photo_ref text not null check (
    photo_ref ~ '^bundled:[a-z0-9-]{1,40}$'
    or photo_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  -- Per variant (default / desktop / phone): crop rectangle as fractions of the
  -- photo, plus the R2 key prefix, format, widths, and size of the rendered crop.
  crops jsonb not null default '{}'::jsonb check (jsonb_typeof(crops) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_placements_slot_position_key unique (slot, position)
);

create trigger site_placements_set_updated_at
  before update on public.site_placements
  for each row execute function private.set_updated_at();

alter table public.site_placements enable row level security;

create policy "Admins manage site_placements"
  on public.site_placements for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.site_placements from anon;

-- A photo still placed somewhere cannot be deleted from the library.
create function private.site_photos_guard_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.site_placements where photo_ref = old.id::text) then
    raise exception 'Remove this photo from the site before deleting it'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger site_photos_guard_delete
  before delete on public.site_photos
  for each row execute function private.site_photos_guard_delete();

-- ---------------------------------------------------------------------
-- Public read: everything the website needs to render placed photos.
-- ---------------------------------------------------------------------
create function public.get_site_media()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'placements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slot', p.slot,
               'position', p.position,
               'photo_ref', p.photo_ref,
               'crops', p.crops
             ) order by p.slot, p.position)
        from public.site_placements p
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ph.id,
               'storage_prefix', ph.storage_prefix,
               'format', ph.format,
               'width', ph.width,
               'height', ph.height,
               'widths', to_jsonb(ph.widths),
               'alt', ph.alt
             ))
        from public.site_photos ph
       where exists (select 1 from public.site_placements p where p.photo_ref = ph.id::text)
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.get_site_media() from public;
grant execute on function public.get_site_media() to anon, authenticated, service_role;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_valid_time_zone(text) to authenticated, service_role;
