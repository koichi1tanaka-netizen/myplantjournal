-- Enable RLS
alter table if exists public.plants disable row level security;
alter table if exists public.growth_entries disable row level security;
alter table if exists public.milestones disable row level security;

-- Plants table
create table public.plants (
  id          text primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  species     text,
  type        text,
  pot_size    text,
  adopted     date,
  water_amount text,
  water_frequency integer default 7,
  sunlight    text,
  notes       text,
  last_watered date,
  color       text,
  created_at  timestamptz default now()
);

-- Growth entries table
create table public.growth_entries (
  id          text primary key,
  plant_id    text references public.plants(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        date,
  note        text,
  height      text,
  emoji       text,
  created_at  timestamptz default now()
);

-- Milestones table
create table public.milestones (
  id          text primary key,
  plant_id    text references public.plants(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        date,
  title       text,
  description text,
  category    text,
  achieved    boolean default false,
  achieved_date date,
  achieved_note text,
  priority    text default 'medium',
  created_at  timestamptz default now()
);

-- Enable Row Level Security
alter table public.plants enable row level security;
alter table public.growth_entries enable row level security;
alter table public.milestones enable row level security;

-- RLS Policies: users can only see and edit their own data
create policy "Users can manage their own plants"
  on public.plants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own growth entries"
  on public.growth_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own milestones"
  on public.milestones for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);