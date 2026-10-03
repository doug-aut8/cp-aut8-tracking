CREATE OR REPLACE FUNCTION public.mkt_bounce_rate(p_start timestamp with time zone, p_end timestamp with time zone, p_source text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text)
RETURNS TABLE(total_sessions bigint, bounced_sessions bigint, bounced_new bigint, bounced_returning bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT pe.session_id, pe.event_type
    FROM public.product_events pe
    WHERE pe.created_at >= p_start
      AND pe.created_at <= p_end
      AND pe.session_id IS NOT NULL
      AND (p_source IS NULL OR pe.utm_source = p_source)
      AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign)
  ),
  per_session AS (
    SELECT
      session_id,
      count(*) AS events,
      bool_or(event_type = 'visita_cardapio_nova') AS is_new,
      bool_or(event_type = 'visita_cardapio_recorrente') AS is_returning
    FROM base
    GROUP BY session_id
  )
  SELECT
    count(*)::bigint AS total_sessions,
    count(*) FILTER (WHERE events = 1)::bigint AS bounced_sessions,
    count(*) FILTER (WHERE events = 1 AND is_new)::bigint AS bounced_new,
    count(*) FILTER (WHERE events = 1 AND is_returning AND NOT is_new)::bigint AS bounced_returning
  FROM per_session;
$function$;

GRANT EXECUTE ON FUNCTION public.mkt_bounce_rate(timestamp with time zone, timestamp with time zone, text, text) TO anon, authenticated, service_role;