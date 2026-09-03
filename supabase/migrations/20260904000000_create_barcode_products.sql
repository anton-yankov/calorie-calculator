-- Persist products entered manually after a barcode catalog miss.
create table public.barcode_products (
  barcode text primary key check (barcode ~ '^[0-9]{7,14}$'),
  name text not null check (length(trim(name)) > 0),
  calories_per_100g double precision not null check (calories_per_100g >= 0),
  protein_per_100g double precision not null check (protein_per_100g >= 0),
  carbs_per_100g double precision not null check (carbs_per_100g >= 0),
  fat_per_100g double precision not null check (fat_per_100g >= 0),
  updated_at timestamptz not null default now()
);

alter table public.barcode_products enable row level security;

grant select, insert, update on public.barcode_products to service_role;
