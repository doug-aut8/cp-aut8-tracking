ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS hidden_in_menu boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;