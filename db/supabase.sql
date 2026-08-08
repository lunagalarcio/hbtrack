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

-- ============================================================
-- Datos de la aplicación (hábitos, tareas, marcas, tiempo...)
-- Almacén genérico clave-valor por usuario.
-- ============================================================
create table if not exists public.user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  data jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

alter table public.user_data enable row level security;

-- Cada usuario solo puede leer y escribir SUS propios datos
drop policy if exists "user_data_select_own" on public.user_data;
create policy "user_data_select_own" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "user_data_insert_own" on public.user_data;
create policy "user_data_insert_own" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_update_own" on public.user_data
  for update using (auth.uid() = user_id);
