// ─── Extra SQL to run in Supabase before using Explore ────────────────────────
//
-- 1. Allow everyone to read all plants/growth/milestones (for explore)
create policy "Public read plants"
  on public.plants for select using (true);
create policy "Public read growth"
  on public.growth_entries for select using (true);
create policy "Public read milestones"
  on public.milestones for select using (true);

-- 2. Reactions table (one emoji reaction per user per plant)
create table public.reactions (
  id         text primary key,
  plant_id   text references public.plants(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  emoji      text not null,
  created_at timestamptz default now(),
  unique(plant_id, user_id)
);
alter table public.reactions enable row level security;
create policy "Anyone reads reactions"  on public.reactions for select using (true);
create policy "Users manage own reactions" on public.reactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Follows table
create table public.follows (
  follower_id  uuid references auth.users(id) on delete cascade,
  following_id uuid references auth.users(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (follower_id, following_id)
);
alter table public.follows enable row level security;
create policy "Anyone reads follows" on public.follows for select using (true);
create policy "Users manage own follows" on public.follows for all
  using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- 4. Public profiles (display name shown in Explore)
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are public" on public.profiles for select using (true);
create policy "Users manage own profile" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- 5. Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();