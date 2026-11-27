
-- 1) Tighten permissive RLS policies (USING/WITH CHECK true)

-- checkout_events: keep anon inserts for tracking but require event_type
DROP POLICY IF EXISTS "Anyone can insert checkout events" ON public.checkout_events;
CREATE POLICY "Anyone can insert checkout events"
  ON public.checkout_events FOR INSERT
  WITH CHECK (event_type IS NOT NULL AND length(event_type) > 0);

-- customer_data: require basic fields for anon insert
DROP POLICY IF EXISTS "customer_data anon insert" ON public.customer_data;
CREATE POLICY "customer_data anon insert"
  ON public.customer_data FOR INSERT
  WITH CHECK (name IS NOT NULL AND phone IS NOT NULL AND length(phone) >= 8);

-- fidelidade_regras: restrict full access to admins only
DROP POLICY IF EXISTS "Authenticated Only " ON public.fidelidade_regras;
CREATE POLICY "Admins manage fidelidade_regras"
  ON public.fidelidade_regras FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
-- allow authenticated users to read active rules
CREATE POLICY "Authenticated read fidelidade_regras"
  ON public.fidelidade_regras FOR SELECT
  TO authenticated
  USING (true);

-- pedidos_sabor_delivery: require identifying fields for anon inserts
DROP POLICY IF EXISTS "pedidos insert" ON public.pedidos_sabor_delivery;
CREATE POLICY "pedidos insert"
  ON public.pedidos_sabor_delivery FOR INSERT
  WITH CHECK (
    nome_cliente IS NOT NULL AND length(nome_cliente) > 0
    AND telefone_cliente IS NOT NULL AND length(telefone_cliente) >= 8
  );

-- product_events: require product identifier
DROP POLICY IF EXISTS "Anyone can insert product events" ON public.product_events;
CREATE POLICY "Anyone can insert product events"
  ON public.product_events FOR INSERT
  WITH CHECK (product_id IS NOT NULL AND event_type IS NOT NULL);

-- 2) Revoke EXECUTE on SECURITY DEFINER functions that should NOT be
--    callable by anon/authenticated (triggers don't need caller EXECUTE).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_stock_zero() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_role_self_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_usuarios_role_self_escalation() FROM PUBLIC, anon, authenticated;

-- has_role / is_admin_or_super are required by RLS policies, so callers must
-- retain EXECUTE. Restrict to authenticated (remove anon/public).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated, service_role;

-- decrement_menu_item_stock: only edge functions (service_role) should call this
REVOKE EXECUTE ON FUNCTION public.decrement_menu_item_stock(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_menu_item_stock(text, integer) TO service_role;
