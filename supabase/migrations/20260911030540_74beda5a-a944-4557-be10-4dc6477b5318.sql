ALTER TABLE public.product_events
ADD COLUMN IF NOT EXISTS items jsonb;

COMMENT ON COLUMN public.product_events.items IS
  'Itens do carrinho para eventos agregados como begin_checkout, abandoned_cart, checkout_finalize e purchase.';