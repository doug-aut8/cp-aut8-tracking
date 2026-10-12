ALTER TABLE public.pedidos_sabor_delivery ADD COLUMN IF NOT EXISTS aniversario text;

CREATE OR REPLACE FUNCTION public.mesa_cliente_tem_pedido_aberto(_mesa text, _telefone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pedidos_sabor_delivery
    WHERE origem = 'salao'
      AND mesa = _mesa
      AND regexp_replace(coalesce(telefone_cliente,''), '\D', '', 'g') = regexp_replace(coalesce(_telefone,''), '\D', '', 'g')
      AND coalesce(status_atual,'') <> 'cancelled'
      AND NOT (coalesce(status_atual,'') IN ('completed','delivered') AND coalesce(payment_status,'') = 'recebido')
  );
$$;

GRANT EXECUTE ON FUNCTION public.mesa_cliente_tem_pedido_aberto(text, text) TO anon, authenticated;