CREATE OR REPLACE FUNCTION public.handle_stock_zero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stock IS NOT NULL AND NEW.stock <= 0 AND (OLD.stock IS NULL OR OLD.stock > 0) THEN
    NEW.available := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_menu_items_stock_zero ON public.menu_items;

CREATE TRIGGER trg_menu_items_stock_zero
BEFORE UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_zero();