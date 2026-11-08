CREATE TABLE public.sugestoes_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  titulo text NOT NULL DEFAULT 'Peça também',
  gatilho_tipo text NOT NULL DEFAULT 'categoria',
  gatilho_ids text[] NOT NULL DEFAULT '{}',
  sugestao_ids text[] NOT NULL DEFAULT '{}',
  prioridade integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sugestoes_regras TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sugestoes_regras TO authenticated;
GRANT ALL ON public.sugestoes_regras TO service_role;
ALTER TABLE public.sugestoes_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sugestoes public read active" ON public.sugestoes_regras FOR SELECT TO anon USING (ativo IS TRUE);
CREATE POLICY "sugestoes auth read" ON public.sugestoes_regras FOR SELECT TO authenticated USING (ativo IS TRUE OR public.is_admin_or_super(auth.uid()));
CREATE POLICY "sugestoes admin insert" ON public.sugestoes_regras FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "sugestoes admin update" ON public.sugestoes_regras FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "sugestoes admin delete" ON public.sugestoes_regras FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER sugestoes_regras_updated_at BEFORE UPDATE ON public.sugestoes_regras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();