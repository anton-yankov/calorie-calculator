-- Run once in the Supabase SQL Editor for an existing installation.
alter table public.barcode_products
  add column if not exists image_url text;
