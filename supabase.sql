-- ============================================================
-- TrackMyHabits - Esquema de Supabase
-- Ejecuta esto en el SQL Editor de tu proyecto de Supabase.
-- ============================================================

-- Tabla de perfiles de usuario (1 registro por usuario)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  email text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;

-- Cada usuario solo puede ver, insertar y actualizar SU perfil
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
