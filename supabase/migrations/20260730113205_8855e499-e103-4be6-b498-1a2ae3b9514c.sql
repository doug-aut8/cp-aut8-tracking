-- 1. Security definer view -> invoker + column-level protection for anon
ALTER VIEW public.tags_rastreamento_public SET (security_invoker = on);

DROP POLICY IF EXISTS "tags_rastreamento public safe read" ON public.tags_rastreamento;
CREATE POLICY "tags_rastreamento public safe read"
ON public.tags_rastreamento
FOR SELECT
TO anon
USING (true);

REVOKE SELECT ON public.tags_rastreamento FROM anon;
GRANT SELECT (id, meta_pixel_id, gtm_container_id, capi_ativo, updated_at)
  ON public.tags_rastreamento TO anon;
GRANT SELECT ON public.tags_rastreamento_public TO anon, authenticated;

-- 2. Public bucket listing: restrict storage.objects SELECT to admins
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Admins can list menu images" ON storage.objects;
CREATE POLICY "Admins can list menu images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'imagens-cardapio' AND public.is_admin_or_super(auth.uid()));

-- 3. SECURITY DEFINER functions not meant to be callable from the API
REVOKE EXECUTE ON FUNCTION public.decrement_menu_item_stock(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_menu_item_stock(text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_stock_zero() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_role_self_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_usuarios_role_self_escalation() FROM PUBLIC, anon, authenticated;

-- 4. Harden analytics event inserts
DROP POLICY IF EXISTS "Anyone can insert checkout events" ON public.checkout_events;
CREATE POLICY "Public can insert valid checkout events"
ON public.checkout_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IS NOT NULL
  AND event_type ~ '^[a-z_]{3,40}$'
  AND COALESCE(cart_total, 0) >= 0 AND COALESCE(cart_total, 0) <= 1000000
  AND COALESCE(discount_value, 0) >= 0 AND COALESCE(discount_value, 0) <= 1000000
  AND COALESCE(length(session_id), 0) <= 100
  AND COALESCE(length(visitor_id), 0) <= 100
  AND COALESCE(length(cupom_name), 0) <= 100
  AND COALESCE(length(utm_source), 0) <= 200
  AND COALESCE(length(utm_medium), 0) <= 200
  AND COALESCE(length(utm_campaign), 0) <= 200
  AND COALESCE(length(utm_content), 0) <= 200
  AND COALESCE(length(utm_term), 0) <= 200
);

DROP POLICY IF EXISTS "Anyone can insert product events" ON public.product_events;
CREATE POLICY "Public can insert valid product events"
ON public.product_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  product_id IS NOT NULL
  AND length(product_id) <= 100
  AND event_type IS NOT NULL
  AND event_type ~ '^[a-z_]{3,40}$'
);