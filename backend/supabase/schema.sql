-- Promiden Pharmaceuticals Ltd — initial Supabase schema (M05)
-- Run in Supabase Dashboard > SQL Editor using the project owner account.
-- The Express server accesses these tables with the SERVICE ROLE key; never expose that key to a browser.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_normalized text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  brand_name text not null default 'PROMIDEN',
  hero_title text not null default 'Better health starts with trusted care.',
  hero_description text not null default 'Your partner in pharmaceutical products, responsible medicine distribution, and healthcare consultancy.',
  email text not null default '',
  phone text not null default '',
  facebook text not null default '',
  twitter text not null default '',
  instagram text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users(id) on delete set null
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  category text not null default '',
  price text not null default '',
  image_url text not null default '',
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_url text not null default '',
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_published_order_idx on public.products (published, sort_order, created_at);
create index if not exists services_published_order_idx on public.services (published, sort_order, created_at);

-- No browser-facing policies are intentionally created for admin_users or the content tables.
-- Keep direct client access denied; all reads/writes go through the Express API.
alter table public.admin_users enable row level security;
alter table public.site_settings enable row level security;
alter table public.products enable row level security;
alter table public.services enable row level security;

-- Public product/service images can be read through this bucket. Writes are performed by the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promiden-public-media', 'promiden-public-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into public.site_settings (id) values (1) on conflict (id) do nothing;
