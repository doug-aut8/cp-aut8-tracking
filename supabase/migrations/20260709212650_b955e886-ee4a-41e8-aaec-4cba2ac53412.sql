ALTER TABLE public.pedidos_sabor_delivery REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_sabor_delivery;