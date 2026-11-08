
ALTER TABLE public.product_events
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS channel text;

CREATE INDEX IF NOT EXISTS product_events_channel_idx ON public.product_events (channel);
CREATE INDEX IF NOT EXISTS product_events_referrer_idx ON public.product_events (referrer);

-- Backfill de canal para eventos existentes com base nas UTMs
UPDATE public.product_events
SET channel = CASE
  WHEN utm_medium ILIKE ANY (ARRAY['cpc','ppc','paid%','ads','paid_social','meta_ads','google_ads']) THEN 'pago'
  WHEN utm_source ILIKE ANY (ARRAY['%instagram%','%facebook%','%tiktok%','%whatsapp%','%youtube%','%linkedin%','%twitter%','%x.com%','ig','fb']) THEN 'social'
  WHEN utm_source ILIKE ANY (ARRAY['%google%','%bing%','%yahoo%','%duckduckgo%','%ecosia%']) THEN 'organico'
  WHEN utm_source IS NULL AND utm_campaign IS NULL THEN 'direto'
  ELSE 'outros'
END
WHERE channel IS NULL;

-- Visit metrics com filtro de canal
CREATE OR REPLACE FUNCTION public.mkt_visit_metrics(
  p_start timestamptz, p_end timestamptz, p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL, p_cidade text DEFAULT NULL, p_channel text DEFAULT NULL)
RETURNS TABLE(total_visits bigint, unique_visitors bigint, new_visitors bigint, returning_visitors bigint, page_views bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT pe.event_type, pe.session_id, pe.visitor_id, pe.id
    FROM public.product_events pe
    WHERE pe.created_at >= p_start
      AND pe.created_at <= p_end
      AND pe.event_type IN ('visita_cardapio_nova', 'visita_cardapio_recorrente', 'view_item')
      AND (p_source IS NULL OR pe.utm_source = p_source)
      AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign)
      AND (p_cidade IS NULL OR pe.cidade = p_cidade)
      AND (p_channel IS NULL OR pe.channel = p_channel)
  ),
  visit_sessions AS (
    SELECT
      COALESCE(session_id, '__no_session__' || id::text) AS sid,
      bool_or(event_type = 'visita_cardapio_nova') AS is_new
    FROM base
    WHERE event_type IN ('visita_cardapio_nova', 'visita_cardapio_recorrente')
    GROUP BY 1
  )
  SELECT
    (SELECT count(*) FROM visit_sessions)::bigint,
    (SELECT count(DISTINCT visitor_id) FROM base
      WHERE event_type IN ('visita_cardapio_nova', 'visita_cardapio_recorrente')
        AND visitor_id IS NOT NULL)::bigint,
    (SELECT count(*) FROM visit_sessions WHERE is_new)::bigint,
    (SELECT count(*) FROM visit_sessions WHERE NOT is_new)::bigint,
    (SELECT count(*) FROM base)::bigint;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_unique_sessions(
  p_start timestamptz, p_end timestamptz, p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL, p_cidade text DEFAULT NULL, p_channel text DEFAULT NULL)
RETURNS bigint LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT count(DISTINCT pe.session_id)::bigint
  FROM public.product_events pe
  WHERE pe.created_at >= p_start
    AND pe.created_at <= p_end
    AND pe.session_id IS NOT NULL
    AND (p_source IS NULL OR pe.utm_source = p_source)
    AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign)
    AND (p_cidade IS NULL OR pe.cidade = p_cidade)
    AND (p_channel IS NULL OR pe.channel = p_channel);
$function$;

-- Relatório de aquisição: origens de campanha + sites de referência
CREATE OR REPLACE FUNCTION public.mkt_acquisition_breakdown(
  p_start timestamptz, p_end timestamptz, p_source text DEFAULT NULL,
  p_campaign text DEFAULT NULL, p_cidade text DEFAULT NULL, p_channel text DEFAULT NULL)
RETURNS TABLE(kind text, value text, sessions bigint, conversions bigint)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT pe.session_id,
           COALESCE(NULLIF(pe.utm_source, ''), 'direto') AS src,
           COALESCE(NULLIF(pe.referrer, ''), 'direto') AS ref,
           COALESCE(NULLIF(pe.channel, ''), 'direto') AS ch,
           pe.event_type
    FROM public.product_events pe
    WHERE pe.created_at >= p_start
      AND pe.created_at <= p_end
      AND pe.session_id IS NOT NULL
      AND (p_source IS NULL OR pe.utm_source = p_source)
      AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign)
      AND (p_cidade IS NULL OR pe.cidade = p_cidade)
      AND (p_channel IS NULL OR pe.channel = p_channel)
  ),
  sess AS (
    SELECT session_id,
           min(src) AS src,
           min(ref) AS ref,
           min(ch) AS ch,
           bool_or(event_type = 'purchase') AS converted
    FROM base GROUP BY session_id
  )
  SELECT 'utm_source'::text, src, count(*)::bigint, count(*) FILTER (WHERE converted)::bigint
  FROM sess GROUP BY src
  UNION ALL
  SELECT 'referrer'::text, ref, count(*)::bigint, count(*) FILTER (WHERE converted)::bigint
  FROM sess GROUP BY ref
  UNION ALL
  SELECT 'channel'::text, ch, count(*)::bigint, count(*) FILTER (WHERE converted)::bigint
  FROM sess GROUP BY ch;
$function$;

GRANT EXECUTE ON FUNCTION public.mkt_acquisition_breakdown(timestamptz, timestamptz, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_visit_metrics(timestamptz, timestamptz, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mkt_unique_sessions(timestamptz, timestamptz, text, text, text, text) TO anon, authenticated, service_role;
