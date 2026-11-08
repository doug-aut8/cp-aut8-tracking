ALTER TABLE public.pedidos_sabor_delivery ADD COLUMN IF NOT EXISTS mesa text, ADD COLUMN IF NOT EXISTS data_nascimento date;

CREATE TABLE public.mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'livre',
  ativa boolean NOT NULL DEFAULT true,
  ultima_atividade timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mesas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesas TO authenticated;
GRANT ALL ON public.mesas TO service_role;
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mesas public read" ON public.mesas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "mesas admin insert" ON public.mesas FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "mesas admin update" ON public.mesas FOR UPDATE TO authenticated USING (public.is_admin_or_super(auth.uid())) WITH CHECK (public.is_admin_or_super(auth.uid()));
CREATE POLICY "mesas admin delete" ON public.mesas FOR DELETE TO authenticated USING (public.is_admin_or_super(auth.uid()));
CREATE TRIGGER mesas_set_updated_at BEFORE UPDATE ON public.mesas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();