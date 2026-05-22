create table if not exists public.app_state (
  id text primary key,
  state jsonb not null default '{"elections":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_app_state_updated_at on public.app_state;

create trigger touch_app_state_updated_at
before update on public.app_state
for each row
execute function public.touch_app_state_updated_at();

insert into public.app_state (id, state)
values ('jbot_vote', '{"elections":[]}'::jsonb)
on conflict (id) do nothing;

alter table public.app_state enable row level security;

drop policy if exists "No direct browser access" on public.app_state;

create policy "No direct browser access"
on public.app_state
for all
using (false)
with check (false);
