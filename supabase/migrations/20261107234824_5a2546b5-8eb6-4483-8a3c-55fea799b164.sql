CREATE TABLE public.campanhas_investimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  utm_campaign TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  valor_investido NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campanhas_investimentos TO authenticated;
GRANT ALL ON public.campanhas_investimentos TO service_role;

ALTER TABLE public.campanhas_investimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage campaign investments" ON public.campanhas_investimentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super-admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super-admin'));

CREATE TRIGGER update_campanhas_investimentos_updated_at
  BEFORE UPDATE ON public.campanhas_investimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();