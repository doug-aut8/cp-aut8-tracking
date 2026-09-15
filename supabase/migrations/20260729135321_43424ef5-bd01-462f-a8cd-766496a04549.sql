
-- =========================================================================
-- 1. Drop all overly permissive policies
-- =========================================================================
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.ceps_especiais;
DROP POLICY IF EXISTS "All Permissive" ON public.configuracoes;
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.cupons;
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.cupons_usos;
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.customer_data;
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.empresa_info;
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.faixas_frete;
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.fidelidade_historico;
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.fidelidade_progresso;
DROP POLICY IF EXISTS "All Permissive" ON public.ga4_snapshots;
DROP POLICY IF EXISTS "All Permissive" ON public.keep_alive;
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.pedidos_sabor_delivery;
DROP POLICY IF EXISTS "All Permissive" ON public.tags_rastreamento;
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.users;
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.usuarios;
DROP POLICY IF EXISTS "Anon can read checkout events" ON public.checkout_events;
DROP POLICY IF EXISTS "Authenticated can read checkout events" ON public.checkout_events;
DROP POLICY IF EXISTS "Anon can read product events" ON public.product_events;
DROP POLICY IF EXISTS "Authenticated users can read product events" ON public.product_events;
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

-- =========================================================================
-- 2. ceps_especiais / faixas_frete / configuracoes: public read, admin write
-- =========================================================================
CREATE POLICY "ceps_especiais public read" ON public.ceps_especiais FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ceps_especiais admin write" ON public.ceps_especiais FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "ceps_especiais admin update" ON public.ceps_especiais FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "ceps_especiais admin delete" ON public.ceps_especiais FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "faixas_frete public read" ON public.faixas_frete FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "faixas_frete admin write" ON public.faixas_frete FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "faixas_frete admin update" ON public.faixas_frete FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "faixas_frete admin delete" ON public.faixas_frete FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "configuracoes public read" ON public.configuracoes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "configuracoes admin write" ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "configuracoes admin update" ON public.configuracoes FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "configuracoes admin delete" ON public.configuracoes FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- =========================================================================
-- 3. empresa_info: public read (all cols), admin write; revoke sensitive col from anon/auth
-- =========================================================================
CREATE POLICY "empresa_info public read" ON public.empresa_info FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "empresa_info admin write" ON public.empresa_info FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "empresa_info admin update" ON public.empresa_info FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "empresa_info admin delete" ON public.empresa_info FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- Column-level security: superfrete_token only visible to admins via table SELECT.
REVOKE SELECT (superfrete_token) ON public.empresa_info FROM anon, authenticated;
GRANT SELECT (superfrete_token) ON public.empresa_info TO service_role;

-- =========================================================================
-- 4. tags_rastreamento: admin-only table; public view with safe fields
-- =========================================================================
CREATE POLICY "tags_rastreamento admin read" ON public.tags_rastreamento FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "tags_rastreamento admin write" ON public.tags_rastreamento FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "tags_rastreamento admin update" ON public.tags_rastreamento FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "tags_rastreamento admin delete" ON public.tags_rastreamento FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE VIEW public.tags_rastreamento_public
WITH (security_invoker = true)
AS SELECT id, meta_pixel_id, gtm_container_id, capi_ativo, updated_at FROM public.tags_rastreamento;
GRANT SELECT ON public.tags_rastreamento_public TO anon, authenticated;
-- Allow the view to bypass the admin-only SELECT: give SELECT on the safe columns only.
GRANT SELECT (id, meta_pixel_id, gtm_container_id, capi_ativo, updated_at) ON public.tags_rastreamento TO anon, authenticated;

-- =========================================================================
-- 5. cupons: public read (validation), admin write. cupons_usos: admin only.
-- =========================================================================
CREATE POLICY "cupons public read" ON public.cupons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cupons admin write" ON public.cupons FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "cupons admin update" ON public.cupons FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "cupons admin delete" ON public.cupons FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE POLICY "cupons_usos admin read" ON public.cupons_usos FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
-- writes performed only by service role via edge function; no client policies

-- =========================================================================
-- 6. customer_data: anon insert (guest checkout), admin read/update/delete
-- =========================================================================
CREATE POLICY "customer_data anon insert" ON public.customer_data FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "customer_data admin read" ON public.customer_data FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "customer_data admin update" ON public.customer_data FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "customer_data admin delete" ON public.customer_data FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- =========================================================================
-- 7. pedidos_sabor_delivery: guest+auth insert, owner/admin read/update, admin delete
-- =========================================================================
CREATE POLICY "pedidos insert" ON public.pedidos_sabor_delivery FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "pedidos owner or admin read" ON public.pedidos_sabor_delivery FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "pedidos admin update" ON public.pedidos_sabor_delivery FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "pedidos admin delete" ON public.pedidos_sabor_delivery FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- =========================================================================
-- 8. fidelidade_historico / fidelidade_progresso: admin only (writes via service role)
-- =========================================================================
CREATE POLICY "fidelidade_historico admin all" ON public.fidelidade_historico FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "fidelidade_progresso admin all" ON public.fidelidade_progresso FOR ALL TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));

-- =========================================================================
-- 9. ga4_snapshots: admin read, service_role writes
-- =========================================================================
CREATE POLICY "ga4_snapshots admin read" ON public.ga4_snapshots FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- =========================================================================
-- 10. keep_alive: service_role only (revoke grants)
-- =========================================================================
REVOKE ALL ON public.keep_alive FROM anon, authenticated;
GRANT ALL ON public.keep_alive TO service_role;

-- =========================================================================
-- 11. users / usuarios: owner + admin
-- =========================================================================
CREATE POLICY "users owner or admin read" ON public.users FOR SELECT TO authenticated USING (id = auth.uid() OR user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "users self insert" ON public.users FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR user_id = auth.uid());
-- Owner may update their own row but NOT change the role column. Enforced via trigger.
CREATE POLICY "users owner update non-role" ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid() OR user_id = auth.uid())
  WITH CHECK (id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "users admin update" ON public.users FOR UPDATE TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "users admin delete" ON public.users FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_admin_or_super(auth.uid()) THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.users;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

CREATE POLICY "usuarios owner or admin read" ON public.usuarios FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "usuarios self insert" ON public.usuarios FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "usuarios admin update" ON public.usuarios FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "usuarios admin delete" ON public.usuarios FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_usuarios_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT public.is_admin_or_super(auth.uid()) THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_usuarios_role_self_escalation ON public.usuarios;
CREATE TRIGGER trg_prevent_usuarios_role_self_escalation
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.prevent_usuarios_role_self_escalation();

-- =========================================================================
-- 12. checkout_events / product_events: admin read
-- =========================================================================
CREATE POLICY "checkout_events admin read" ON public.checkout_events FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE POLICY "product_events admin read" ON public.product_events FOR SELECT TO authenticated USING (public.is_admin_or_super(auth.uid()));

-- =========================================================================
-- 13. profiles: owner or admin read
-- =========================================================================
CREATE POLICY "profiles owner or admin read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin_or_super(auth.uid()));

-- =========================================================================
-- 14. Function search_path + EXECUTE hardening
-- =========================================================================
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.update_customer_data_updated_at() SET search_path = public;
ALTER FUNCTION public.update_empresa_info_updated_at() SET search_path = public;
ALTER FUNCTION public.update_profiles_updated_at() SET search_path = public;
ALTER FUNCTION public.get_user_role(text) SET search_path = public;
ALTER FUNCTION public.get_user_role(uuid) SET search_path = public;
ALTER FUNCTION public.get_ltv_by_utm_source(timestamptz, timestamptz) SET search_path = public;
ALTER FUNCTION public.get_ltv_by_utm_campaign(timestamptz, timestamptz) SET search_path = public;
ALTER FUNCTION public.execute_cron_update(text, text, text) SET search_path = public;

-- Revoke EXECUTE on privileged SECURITY DEFINER functions from anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.decrement_menu_item_stock(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_cron_update(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;

-- =========================================================================
-- 15. Storage: restrict listing of imagens-cardapio; keep public GET via URL
-- =========================================================================
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;

CREATE POLICY "imagens-cardapio admin list"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'imagens-cardapio' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "imagens-cardapio admin upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'imagens-cardapio' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "imagens-cardapio admin update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'imagens-cardapio' AND public.is_admin_or_super(auth.uid()))
  WITH CHECK (bucket_id = 'imagens-cardapio' AND public.is_admin_or_super(auth.uid()));

CREATE POLICY "imagens-cardapio admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'imagens-cardapio' AND public.is_admin_or_super(auth.uid()));
