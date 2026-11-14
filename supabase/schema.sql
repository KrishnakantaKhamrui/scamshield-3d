create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('phone', 'upi', 'url', 'domain')),
  value_hash text not null check (value_hash ~ '^[a-f0-9]{64}$'),
  display_value text not null,
  category text not null,
  count integer not null default 1 check (count > 0),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (type, value_hash)
);

alter table public.reports enable row level security;
revoke all on table public.reports from anon, authenticated;
grant select on table public.reports to service_role;

create or replace function public.report_entity(
  p_type text,
  p_value_hash text,
  p_display_value text,
  p_category text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_type is null
    or p_type not in ('phone', 'upi', 'url', 'domain')
    or p_value_hash is null
    or p_value_hash !~ '^[a-f0-9]{64}$'
    or p_display_value is null
    or length(p_display_value) > 255
    or p_category is null
    or length(p_category) > 64 then
    raise exception 'Invalid report';
  end if;

  insert into public.reports as existing_report
    (type, value_hash, display_value, category)
  values (p_type, p_value_hash, p_display_value, p_category)
  on conflict (type, value_hash) do update
  set display_value = excluded.display_value,
      category = excluded.category,
      count = existing_report.count + 1,
      last_seen = now();
end;
$$;

revoke all on function public.report_entity(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.report_entity(text, text, text, text)
  to service_role;
