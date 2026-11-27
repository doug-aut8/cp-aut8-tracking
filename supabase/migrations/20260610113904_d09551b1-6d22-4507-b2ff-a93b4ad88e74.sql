ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS stock integer;

CREATE OR REPLACE FUNCTION public.decrement_menu_item_stock(_item_id text, _qty integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.menu_items
  SET stock = GREATEST(0, COALESCE(stock, 0) - _qty)
  WHERE id = _item_id AND stock IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_menu_item_stock(text, integer) TO anon, authenticated, service_role;