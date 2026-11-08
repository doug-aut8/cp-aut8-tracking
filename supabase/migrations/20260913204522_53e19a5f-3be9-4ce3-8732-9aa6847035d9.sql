-- 1. empresa_info: esconder superfrete_token do público
DROP POLICY IF EXISTS "empresa_info public read" ON public.empresa_info;

CREATE POLICY "empresa_info admin read"
ON public.empresa_info
FOR SELECT
TO authenticated
USING (public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE VIEW public.empresa_info_publica AS
SELECT
  id, nome, endereco, telefone, whatsapp, cep, rua, bairro, cidade, estado,
  complemento, pais, numero, modelo_frete, user_id, horarios_funcionamento,
  default_peso_g, default_altura_cm, default_largura_cm, default_comprimento_cm
FROM public.empresa_info;

GRANT SELECT ON public.empresa_info_publica TO anon, authenticated;
GRANT ALL ON public.empresa_info TO service_role;

-- 2. tags_rastreamento: esconder meta_access_token do público
DROP POLICY IF EXISTS "tags_rastreamento public safe read" ON public.tags_rastreamento;

CREATE OR REPLACE VIEW public.tags_rastreamento_publica AS
SELECT id, meta_pixel_id, gtm_container_id, capi_ativo
FROM public.tags_rastreamento;

GRANT SELECT ON public.tags_rastreamento_publica TO anon, authenticated;
GRANT ALL ON public.tags_rastreamento TO service_role;

-- 3. cupons: apenas cupons ativos e válidos ficam legíveis publicamente
DROP POLICY IF EXISTS "cupons public read" ON public.cupons;

CREATE POLICY "cupons public read active"
ON public.cupons
FOR SELECT
TO anon
USING (ativo IS TRUE AND data_inicio <= CURRENT_DATE AND data_fim >= CURRENT_DATE);

CREATE POLICY "cupons authenticated read active or admin"
ON public.cupons
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_super(auth.uid())
  OR (ativo IS TRUE AND data_inicio <= CURRENT_DATE AND data_fim >= CURRENT_DATE)
);

-- 4. fidelidade_regras: remover acesso total público
DROP POLICY IF EXISTS "Acesso público total temporário" ON public.fidelidade_regras;

CREATE POLICY "fidelidade_regras anon read active"
ON public.fidelidade_regras
FOR SELECT
TO anon
USING (ativo IS TRUE);

-- 5. customer_data: remover política de insert duplicada/permissiva
DROP POLICY IF EXISTS "customer_data anon insert" ON public.customer_data;

-- 6. funções SECURITY DEFINER internas não devem ser chamáveis pela API
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.is_admin_or_super(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_super(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_stock_zero() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_role_self_escalation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_usuarios_role_self_escalation() FROM PUBLIC, anon, authenticated;