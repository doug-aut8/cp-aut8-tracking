ALTER TABLE public.configuracoes ADD COLUMN empresa_id uuid REFERENCES public.empresa_info(id) ON DELETE CASCADE;
CREATE INDEX idx_configuracoes_empresa_id ON public.configuracoes(empresa_id);