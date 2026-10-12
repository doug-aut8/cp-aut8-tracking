CREATE OR REPLACE FUNCTION public.mkt_unique_sessions(
  p_start timestamptz,
  p_end timestamptz,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT count(DISTINCT pe.session_id)::bigint
  FROM public.product_events pe
  WHERE pe.created_at >= p_start
    AND pe.created_at <= p_end
    AND pe.session_id IS NOT NULL
    AND (p_source IS NULL OR pe.utm_source = p_source)
    AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign);
$$;

GRANT EXECUTE ON FUNCTION public.mkt_unique_sessions(timestamptz, timestamptz, text, text) TO authenticated, service_role;