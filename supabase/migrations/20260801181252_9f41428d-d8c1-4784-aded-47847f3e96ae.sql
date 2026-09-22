ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category ORDER BY name) - 1 AS rn
  FROM public.menu_items
)
UPDATE public.menu_items m
SET display_order = o.rn
FROM ordered o
WHERE m.id = o.id;

CREATE INDEX IF NOT EXISTS menu_items_category_display_order_idx
  ON public.menu_items (category, display_order);