
CREATE OR REPLACE FUNCTION public.current_user_phones()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_remove(array_agg(DISTINCT regexp_replace(p, '\D', '', 'g')), '')
  FROM (
    SELECT phone AS p FROM public.profiles WHERE id = auth.uid()
    UNION ALL
    SELECT phone FROM public.users WHERE id = auth.uid() OR user_id = auth.uid()
  ) s
  WHERE p IS NOT NULL;
$$;

GRANT SELECT ON public.fidelidade_progresso TO authenticated;
GRANT SELECT ON public.fidelidade_historico TO authenticated;

DROP POLICY IF EXISTS "fidelidade_progresso own read" ON public.fidelidade_progresso;
CREATE POLICY "fidelidade_progresso own read"
ON public.fidelidade_progresso FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR regexp_replace(coalesce(telefone_cliente,''), '\D', '', 'g') = ANY (coalesce(public.current_user_phones(), '{}'::text[]))
);

DROP POLICY IF EXISTS "fidelidade_historico own read" ON public.fidelidade_historico;
CREATE POLICY "fidelidade_historico own read"
ON public.fidelidade_historico FOR SELECT TO authenticated
USING (
  regexp_replace(coalesce(telefone_cliente,''), '\D', '', 'g') = ANY (coalesce(public.current_user_phones(), '{}'::text[]))
);
