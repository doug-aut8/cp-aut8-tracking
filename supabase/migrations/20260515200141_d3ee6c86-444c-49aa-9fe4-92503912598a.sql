
ALTER TABLE public.pedidos_sabor_delivery
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS subtotal numeric,
  ADD COLUMN IF NOT EXISTS frete numeric,
  ADD COLUMN IF NOT EXISTS desconto numeric,
  ADD COLUMN IF NOT EXISTS payment_status text;

CREATE INDEX IF NOT EXISTS idx_pedidos_sabor_delivery_telefone ON public.pedidos_sabor_delivery (telefone_cliente);
CREATE INDEX IF NOT EXISTS idx_pedidos_sabor_delivery_user_id ON public.pedidos_sabor_delivery (user_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_sabor_delivery_criado_em ON public.pedidos_sabor_delivery (criado_em DESC);
