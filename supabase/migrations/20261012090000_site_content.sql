-- =====================================================================
-- Website wording edited in Admin → Website text
-- =====================================================================
-- One row. `content` holds only the sections an admin has saved, keyed by
-- section ("basics", "story", ...); anything missing falls back to the
-- defaults in src/content/site.ts. The app validates every section before
-- saving (src/lib/site/content.ts). Guests read it through
-- get_site_content(); they have no table access.

create table public.site_content (
  id boolean primary key default true constraint site_content_singleton check (id),
  content jsonb not null default '{}'::jsonb
    constraint site_content_is_object check (jsonb_typeof(content) = 'object')
    constraint site_content_size check (pg_column_size(content) <= 262144),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_content (id) values (true);

create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function private.set_updated_at();

alter table public.site_content enable row level security;

create policy "Admins read site_content"
  on public.site_content for select
  to authenticated
  using ((select private.is_admin()));

create policy "Admins update site_content"
  on public.site_content for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.site_content from anon;
grant select, update on public.site_content to authenticated;
grant all on public.site_content to service_role;

-- Public wording for the website. Display data only.
create function public.get_site_content()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.content from public.site_content c where c.id), '{}'::jsonb);
$$;

revoke execute on function public.get_site_content() from public;
grant execute on function public.get_site_content() to anon, authenticated, service_role;

-- Saves (or, with p_value = null, resets to default) one section atomically,
-- so two admins editing different sections never overwrite each other.
-- SECURITY INVOKER: RLS on site_content applies, plus an explicit admin check.
create function public.save_site_content_section(p_section text, p_value jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;
  if p_section is null or p_section !~ '^[a-z][a-zA-Z]{0,39}$' then
    raise exception 'invalid_section' using errcode = 'check_violation';
  end if;
  if p_value is not null and jsonb_typeof(p_value) <> 'object' then
    raise exception 'invalid_section_value' using errcode = 'check_violation';
  end if;

  update public.site_content c
     set content = case
                     when p_value is null then c.content - p_section
                     else c.content || jsonb_build_object(p_section, p_value)
                   end,
         updated_by = auth.uid()
   where c.id;
end;
$$;

revoke execute on function public.save_site_content_section(text, jsonb) from public;
grant execute on function public.save_site_content_section(text, jsonb) to authenticated;
