
ALTER TABLE public.empresa_info
  ADD COLUMN IF NOT EXISTS superfrete_token text,
  ADD COLUMN IF NOT EXISTS superfrete_sandbox boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS superfrete_servicos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_peso_g numeric,
  ADD COLUMN IF NOT EXISTS default_altura_cm numeric,
  ADD COLUMN IF NOT EXISTS default_largura_cm numeric,
  ADD COLUMN IF NOT EXISTS default_comprimento_cm numeric;
