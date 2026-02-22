create table if not exists public.user_workout_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_workout_snapshots_updated_at_idx
  on public.user_workout_snapshots (updated_at desc);

alter table public.user_workout_snapshots enable row level security;

drop policy if exists "Users can read own workout snapshot" on public.user_workout_snapshots;
create policy "Users can read own workout snapshot"
  on public.user_workout_snapshots
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own workout snapshot" on public.user_workout_snapshots;
create policy "Users can insert own workout snapshot"
  on public.user_workout_snapshots
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own workout snapshot" on public.user_workout_snapshots;
create policy "Users can update own workout snapshot"
  on public.user_workout_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own workout snapshot" on public.user_workout_snapshots;
create policy "Users can delete own workout snapshot"
  on public.user_workout_snapshots
  for delete
  using (auth.uid() = user_id);

create or replace function public.touch_user_workout_snapshots_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists user_workout_snapshots_touch on public.user_workout_snapshots;
create trigger user_workout_snapshots_touch
before update on public.user_workout_snapshots
for each row
execute function public.touch_user_workout_snapshots_updated_at();
