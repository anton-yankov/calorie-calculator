-- Run once in the Supabase SQL Editor for an existing installation so the
-- Products page can delete saved products.
grant delete on public.barcode_products to service_role;
