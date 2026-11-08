CREATE OR REPLACE FUNCTION public.prevent_duplicate_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref uuid;
BEGIN
  -- Rejeita reinserções vindas de integrações externas (n8n) que reenviam
  -- o pedido usando o id original no campo codigo_pedido.
  BEGIN
    ref := NEW.codigo_pedido::uuid;
  EXCEPTION WHEN OTHERS THEN
    ref := NULL;
  END;

  IF ref IS NOT NULL AND EXISTS (SELECT 1 FROM public.pedidos_sabor_delivery WHERE id = ref) THEN
    RETURN NULL;
  END IF;

  -- Duplicata por conteúdo: mesmo telefone/valor criado nos últimos 10 minutos
  IF NEW.telefone_cliente IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.pedidos_sabor_delivery p
    WHERE p.telefone_cliente = NEW.telefone_cliente
      AND COALESCE(p.valor_total,0) = COALESCE(NEW.valor_total,0)
      AND COALESCE(p.criado_em, p.data_criacao) = COALESCE(NEW.criado_em, NEW.data_criacao)
      AND p.id <> NEW.id
  ) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_pedido ON public.pedidos_sabor_delivery;
CREATE TRIGGER trg_prevent_duplicate_pedido
BEFORE INSERT ON public.pedidos_sabor_delivery
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_pedido();

DELETE FROM public.pedidos_sabor_delivery d
WHERE EXISTS (
  SELECT 1 FROM public.pedidos_sabor_delivery o
  WHERE o.id::text = d.codigo_pedido AND o.id <> d.id
);