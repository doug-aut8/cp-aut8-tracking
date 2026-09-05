
ALTER TABLE public.fidelidade_regras
  ALTER COLUMN criterio DROP NOT NULL,
  ALTER COLUMN meta DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS produto_requerido jsonb,
  ADD COLUMN IF NOT EXISTS quantidade_necessaria integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS validade_dias integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS premio_produto jsonb,
  ADD COLUMN IF NOT EXISTS premio_cupom_tipo text,
  ADD COLUMN IF NOT EXISTS premio_cupom_valor numeric,
  ADD COLUMN IF NOT EXISTS premio_validade_dias integer NOT NULL DEFAULT 30;

ALTER TABLE public.fidelidade_progresso
  DROP CONSTRAINT IF EXISTS fidelidade_progresso_telefone_cliente_key,
  ADD COLUMN IF NOT EXISTS regra_id uuid,
  ADD COLUMN IF NOT EXISTS eventos jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS fidelidade_progresso_telefone_regra_uidx
  ON public.fidelidade_progresso (telefone_cliente, regra_id);

ALTER TABLE public.fidelidade_historico
  ADD COLUMN IF NOT EXISTS telefone_cliente text,
  ADD COLUMN IF NOT EXISTS nome_cliente text,
  ADD COLUMN IF NOT EXISTS cupom_codigo text,
  ADD COLUMN IF NOT EXISTS premio_descricao text,
  ADD COLUMN IF NOT EXISTS resgatado boolean NOT NULL DEFAULT false;
