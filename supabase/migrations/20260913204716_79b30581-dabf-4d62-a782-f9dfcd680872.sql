-- Credenciais da empresa (Superfrete) em tabela restrita
CREATE TABLE public.empresa_credenciais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresa_info(id) ON DELETE CASCADE,
  superfrete_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_credenciais TO authenticated;
GRANT ALL ON public.empresa_credenciais TO service_role;

ALTER TABLE public.empresa_credenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_credenciais admin all"
ON public.empresa_credenciais
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER empresa_credenciais_updated_at
BEFORE UPDATE ON public.empresa_credenciais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.empresa_credenciais (empresa_id, superfrete_token)
SELECT id, superfrete_token FROM public.empresa_info
ON CONFLICT (empresa_id) DO NOTHING;

DROP VIEW IF EXISTS public.empresa_info_publica;
ALTER TABLE public.empresa_info DROP COLUMN superfrete_token;

DROP POLICY IF EXISTS "empresa_info admin read" ON public.empresa_info;
CREATE POLICY "empresa_info public read"
ON public.empresa_info
FOR SELECT
TO anon, authenticated
USING (true);

-- Token do Meta em tabela restrita
CREATE TABLE public.tags_rastreamento_privado (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tag_id bigint NOT NULL,
  meta_access_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags_rastreamento_privado TO authenticated;
GRANT ALL ON public.tags_rastreamento_privado TO service_role;

ALTER TABLE public.tags_rastreamento_privado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_rastreamento_privado admin all"
ON public.tags_rastreamento_privado
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE TRIGGER tags_rastreamento_privado_updated_at
BEFORE UPDATE ON public.tags_rastreamento_privado
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.tags_rastreamento_privado (tag_id, meta_access_token)
SELECT id, meta_access_token FROM public.tags_rastreamento
ON CONFLICT (tag_id) DO NOTHING;

DROP VIEW IF EXISTS public.tags_rastreamento_publica;
ALTER TABLE public.tags_rastreamento DROP COLUMN meta_access_token;

CREATE POLICY "tags_rastreamento public safe read"
ON public.tags_rastreamento
FOR SELECT
TO anon, authenticated
USING (true);