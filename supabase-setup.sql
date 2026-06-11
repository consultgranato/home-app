-- ============================================================
-- Our Life — Supabase SQL Setup
-- Run this entire file in your Supabase SQL editor once.
-- ============================================================

-- ---- Tables ----

create table households (
  id uuid primary key default gen_random_uuid(),
  home_name text default 'Our Home',
  name1 text default 'Tony',
  name2 text default 'Alex',
  color1 text default 'indigo',
  color2 text default 'rose',
  color_both text default 'emerald',
  important_text text default '',
  created_at timestamptz default now()
);

create table household_members (
  household_id uuid references households on delete cascade,
  user_id uuid references auth.users on delete cascade,
  slot int,
  primary key (household_id, user_id)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  event_date date not null,
  title text not null,
  time text,
  person text not null default 'both' check (person in ('p1','p2','both')),
  created_at timestamptz default now()
);

create table dinners (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  name text,
  notes text,
  unique (household_id, weekday)
);

create table grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  category text not null default 'Other',
  checked boolean not null default false,
  created_at timestamptz default now()
);

create table todos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  list text not null check (list in ('shared','p1','p2')),
  text text not null,
  done boolean not null default false,
  created_at timestamptz default now()
);

create table chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  frequency text not null default 'weekly' check (frequency in ('daily','weekly','monthly')),
  assigned_to text not null default 'both' check (assigned_to in ('p1','p2','both')),
  last_done date,
  created_at timestamptz default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text,
  destination text,
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

create table trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips on delete cascade,
  household_id uuid not null references households on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at timestamptz default now()
);

create table trip_ideas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

create table visited_places (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  kind text not null check (kind in ('country','state')),
  name text not null,
  created_at timestamptz default now()
);

create table favorite_meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table key_dates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  label text not null,
  month int not null check (month between 1 and 12),
  day int not null check (day between 1 and 31),
  created_at timestamptz default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  body text default '',
  created_at timestamptz default now()
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  parent_type text not null check (parent_type in ('note','important')),
  parent_id uuid,
  name text,
  mime text,
  storage_path text not null,
  created_at timestamptz default now()
);

-- ---- RLS helper ----

create or replace function is_member(h uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from household_members
    where household_id = h and user_id = auth.uid()
  );
$$;

-- ---- Enable RLS ----

alter table households         enable row level security;
alter table household_members  enable row level security;
alter table events             enable row level security;
alter table dinners            enable row level security;
alter table grocery_items      enable row level security;
alter table todos              enable row level security;
alter table chores             enable row level security;
alter table trips              enable row level security;
alter table trip_items         enable row level security;
alter table trip_ideas         enable row level security;
alter table visited_places     enable row level security;
alter table favorite_meals     enable row level security;
alter table key_dates          enable row level security;
alter table notes              enable row level security;
alter table attachments        enable row level security;

-- ---- RLS Policies ----

create policy "h_read"   on households for select using (is_member(id));
create policy "h_update" on households for update using (is_member(id)) with check (is_member(id));

create policy "hm_self"  on household_members for select using (user_id = auth.uid());
create policy "hm_insert" on household_members for insert with check (user_id = auth.uid());

create policy "events_all"        on events         for all using (is_member(household_id)) with check (is_member(household_id));
create policy "dinners_all"       on dinners        for all using (is_member(household_id)) with check (is_member(household_id));
create policy "grocery_all"       on grocery_items  for all using (is_member(household_id)) with check (is_member(household_id));
create policy "todos_all"         on todos          for all using (is_member(household_id)) with check (is_member(household_id));
create policy "chores_all"        on chores         for all using (is_member(household_id)) with check (is_member(household_id));
create policy "trips_all"         on trips          for all using (is_member(household_id)) with check (is_member(household_id));
create policy "trip_items_all"    on trip_items     for all using (is_member(household_id)) with check (is_member(household_id));
create policy "trip_ideas_all"    on trip_ideas     for all using (is_member(household_id)) with check (is_member(household_id));
create policy "visited_all"       on visited_places for all using (is_member(household_id)) with check (is_member(household_id));
create policy "meals_all"         on favorite_meals for all using (is_member(household_id)) with check (is_member(household_id));
create policy "key_dates_all"     on key_dates      for all using (is_member(household_id)) with check (is_member(household_id));
create policy "notes_all"         on notes          for all using (is_member(household_id)) with check (is_member(household_id));
create policy "attachments_all"   on attachments    for all using (is_member(household_id)) with check (is_member(household_id));

-- ---- Households INSERT (for household creation) ----
-- The household creator inserts the row, then adds themselves as a member.
-- We allow any authenticated user to insert a new household.
create policy "h_insert" on households for insert with check (true);

-- ---- Enable Realtime ----
-- Run in Supabase Dashboard → Database → Replication, or via SQL:

alter publication supabase_realtime add table events;
alter publication supabase_realtime add table dinners;
alter publication supabase_realtime add table grocery_items;
alter publication supabase_realtime add table todos;
alter publication supabase_realtime add table chores;
alter publication supabase_realtime add table trips;
alter publication supabase_realtime add table trip_items;
alter publication supabase_realtime add table trip_ideas;
alter publication supabase_realtime add table visited_places;
alter publication supabase_realtime add table favorite_meals;
alter publication supabase_realtime add table key_dates;
alter publication supabase_realtime add table notes;
alter publication supabase_realtime add table attachments;
alter publication supabase_realtime add table households;

-- ============================================================
-- STORAGE BUCKET (do this in Supabase Dashboard → Storage)
-- ============================================================
-- 1. Create a new bucket named "attachments" (private)
-- 2. Add an RLS policy on storage.objects for that bucket:
--
-- For SELECT (download):
--   (bucket_id = 'attachments') AND (auth.uid() IS NOT NULL)
--   AND (
--     EXISTS (
--       SELECT 1 FROM household_members hm
--       JOIN attachments a ON a.household_id = hm.household_id
--       WHERE hm.user_id = auth.uid()
--       AND a.storage_path = name
--     )
--   )
--
-- For INSERT/DELETE: same pattern or use the simpler:
--   (bucket_id = 'attachments') AND (auth.uid() IS NOT NULL)
--   AND (SPLIT_PART(name, '/', 1) IN (
--     SELECT household_id::text FROM household_members WHERE user_id = auth.uid()
--   ))
-- ============================================================
