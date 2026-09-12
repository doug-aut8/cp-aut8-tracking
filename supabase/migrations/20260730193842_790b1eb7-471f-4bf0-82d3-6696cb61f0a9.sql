ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS submenu_name text,
  ADD COLUMN IF NOT EXISTS submenu_description text,
  ADD COLUMN IF NOT EXISTS submenu_item_ids text[] NOT NULL DEFAULT '{}'::text[];