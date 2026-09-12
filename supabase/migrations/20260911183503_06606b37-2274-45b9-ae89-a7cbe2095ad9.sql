CREATE OR REPLACE FUNCTION public.mkt_avg_visit_duration(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH session_durations AS (
    SELECT
      pe.session_id,
      LEAST(
        EXTRACT(EPOCH FROM (MAX(pe.created_at) - MIN(pe.created_at))),
        1800::numeric
      ) AS duration_seconds
    FROM public.product_events pe
    WHERE pe.created_at >= p_start
      AND pe.created_at <= p_end
      AND pe.session_id IS NOT NULL
      AND (p_source IS NULL OR pe.utm_source = p_source)
      AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign)
    GROUP BY pe.session_id
  )
  SELECT COALESCE(AVG(duration_seconds), 0)::numeric
  FROM session_durations;
$$;

REVOKE ALL ON FUNCTION public.mkt_avg_visit_duration(timestamp with time zone, timestamp with time zone, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mkt_avg_visit_duration(timestamp with time zone, timestamp with time zone, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_avg_visit_duration(timestamp with time zone, timestamp with time zone, text, text) TO service_role;