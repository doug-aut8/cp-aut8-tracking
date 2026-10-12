ALTER TABLE public.product_events ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.checkout_events ADD COLUMN IF NOT EXISTS cidade text;
CREATE INDEX IF NOT EXISTS product_events_cidade_idx ON public.product_events (cidade);

CREATE OR REPLACE FUNCTION public.mkt_visit_metrics(p_start timestamp with time zone, p_end timestamp with time zone, p_source text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text)
 RETURNS TABLE(total_visits bigint, unique_visitors bigint, new_visitors bigint, returning_visitors bigint, page_views bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT pe.event_type, pe.session_id, pe.visitor_id, pe.id
    FROM public.product_events pe
    WHERE pe.created_at >= p_start
      AND pe.created_at <= p_end
      AND pe.event_type IN ('visita_cardapio_nova', 'visita_cardapio_recorrente', 'view_item')
      AND (p_source IS NULL OR pe.utm_source = p_source)
      AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign)
      AND (p_cidade IS NULL OR pe.cidade = p_cidade)
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

CREATE OR REPLACE FUNCTION public.mkt_avg_visit_duration(p_start timestamp with time zone, p_end timestamp with time zone, p_source text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH session_durations AS (
    SELECT
      pe.session_id,
      LEAST(EXTRACT(EPOCH FROM (MAX(pe.created_at) - MIN(pe.created_at))), 1800::numeric) AS duration_seconds
    FROM public.product_events pe
    WHERE pe.created_at >= p_start
      AND pe.created_at <= p_end
      AND pe.session_id IS NOT NULL
      AND (p_source IS NULL OR pe.utm_source = p_source)
      AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign)
      AND (p_cidade IS NULL OR pe.cidade = p_cidade)
    GROUP BY pe.session_id
  )
  SELECT COALESCE(AVG(duration_seconds), 0)::numeric FROM session_durations;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_unique_sessions(p_start timestamp with time zone, p_end timestamp with time zone, p_source text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT count(DISTINCT pe.session_id)::bigint
  FROM public.product_events pe
  WHERE pe.created_at >= p_start
    AND pe.created_at <= p_end
    AND pe.session_id IS NOT NULL
    AND (p_source IS NULL OR pe.utm_source = p_source)
    AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign)
    AND (p_cidade IS NULL OR pe.cidade = p_cidade);
$function$;

CREATE OR REPLACE FUNCTION public.mkt_bounce_rate(p_start timestamp with time zone, p_end timestamp with time zone, p_source text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text)
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
      AND (p_cidade IS NULL OR pe.cidade = p_cidade)
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
    count(*)::bigint,
    count(*) FILTER (WHERE events = 1)::bigint,
    count(*) FILTER (WHERE events = 1 AND is_new)::bigint,
    count(*) FILTER (WHERE events = 1 AND is_returning AND NOT is_new)::bigint
  FROM per_session;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_daily_visit_metrics(p_start timestamp with time zone, p_end timestamp with time zone, p_source text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text)
 RETURNS TABLE(day date, total_visits bigint, unique_visitors bigint, new_visitors bigint, returning_visitors bigint, page_views bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      (pe.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
      pe.event_type, pe.session_id, pe.visitor_id, pe.id
    FROM public.product_events pe
    WHERE pe.created_at >= p_start
      AND pe.created_at <= p_end
      AND pe.event_type IN ('visita_cardapio_nova', 'visita_cardapio_recorrente', 'view_item')
      AND (p_source IS NULL OR pe.utm_source = p_source)
      AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign)
      AND (p_cidade IS NULL OR pe.cidade = p_cidade)
  ),
  views AS (SELECT day, count(*)::bigint AS page_views FROM base GROUP BY day),
  visit_sessions AS (
    SELECT day, COALESCE(session_id, '__no_session__' || id::text) AS sid,
      bool_or(event_type = 'visita_cardapio_nova') AS is_new
    FROM base
    WHERE event_type IN ('visita_cardapio_nova', 'visita_cardapio_recorrente')
    GROUP BY 1, 2
  ),
  sess_agg AS (
    SELECT day, count(*)::bigint AS total_visits,
      count(*) FILTER (WHERE is_new)::bigint AS new_visitors,
      count(*) FILTER (WHERE NOT is_new)::bigint AS returning_visitors
    FROM visit_sessions GROUP BY day
  ),
  visitors AS (
    SELECT day, count(DISTINCT visitor_id)::bigint AS unique_visitors
    FROM base
    WHERE event_type IN ('visita_cardapio_nova', 'visita_cardapio_recorrente') AND visitor_id IS NOT NULL
    GROUP BY day
  )
  SELECT v.day, COALESCE(s.total_visits, 0), COALESCE(u.unique_visitors, 0),
    COALESCE(s.new_visitors, 0), COALESCE(s.returning_visitors, 0), COALESCE(v.page_views, 0)
  FROM views v
  LEFT JOIN sess_agg s ON s.day = v.day
  LEFT JOIN visitors u ON u.day = v.day
  ORDER BY v.day;
$function$;

CREATE OR REPLACE FUNCTION public.mkt_funnel_overview(p_start timestamp with time zone, p_end timestamp with time zone, p_source text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_cidade text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      pe.event_type,
      COALESCE(pe.session_id, '__no_session__' || pe.id::text) AS sid,
      pe.created_at,
      (pe.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
      pe.category
    FROM public.product_events pe
    WHERE pe.created_at >= p_start
      AND pe.created_at <= p_end
      AND pe.event_type IN (
        'visita_cardapio_nova', 'visita_cardapio_recorrente', 'view_item',
        'add_to_cart', 'begin_checkout', 'checkout_finalize', 'purchase'
      )
      AND (p_source IS NULL OR pe.utm_source = p_source)
      AND (p_campaign IS NULL OR pe.utm_campaign = p_campaign)
      AND (p_cidade IS NULL OR pe.cidade = p_cidade)
  ),
  ev AS (
    SELECT *, (event_type IN ('visita_cardapio_nova', 'visita_cardapio_recorrente')) AS is_visit
    FROM base
    WHERE event_type IN ('visita_cardapio_nova', 'visita_cardapio_recorrente')
       OR category IS DISTINCT FROM 'brinde'
  ),
  stages AS (
    SELECT
      count(DISTINCT sid) FILTER (WHERE is_visit)::bigint AS visits,
      count(DISTINCT sid) FILTER (WHERE event_type = 'view_item')::bigint AS item_views,
      count(DISTINCT sid) FILTER (WHERE event_type = 'add_to_cart')::bigint AS add_to_cart,
      count(DISTINCT sid) FILTER (WHERE event_type = 'begin_checkout')::bigint AS begin_checkout,
      count(DISTINCT sid) FILTER (WHERE event_type = 'checkout_finalize')::bigint AS end_checkout,
      count(DISTINCT sid) FILTER (WHERE event_type = 'purchase')::bigint AS purchases
    FROM ev
  ),
  checkout AS (
    SELECT sid,
      min(created_at) FILTER (WHERE event_type = 'begin_checkout') AS begin_at,
      min(created_at) FILTER (WHERE event_type IN ('checkout_finalize', 'purchase')) AS finalize_at,
      min(day) FILTER (WHERE event_type = 'begin_checkout') AS begin_day
    FROM ev GROUP BY sid
  ),
  durations AS (
    SELECT begin_day AS day, EXTRACT(EPOCH FROM (finalize_at - begin_at)) AS secs
    FROM checkout
    WHERE begin_at IS NOT NULL AND finalize_at IS NOT NULL AND finalize_at >= begin_at
      AND finalize_at - begin_at <= interval '15 minutes'
  ),
  daily AS (
    SELECT day,
      count(DISTINCT sid) FILTER (WHERE is_visit)::bigint AS visits,
      count(DISTINCT sid) FILTER (WHERE event_type = 'add_to_cart')::bigint AS add_to_cart,
      count(DISTINCT sid) FILTER (WHERE event_type = 'begin_checkout')::bigint AS begin_checkout,
      count(DISTINCT sid) FILTER (WHERE event_type = 'purchase')::bigint AS purchases
    FROM ev GROUP BY day
  ),
  daily_dur AS (SELECT day, round(avg(secs))::bigint AS avg_secs FROM durations GROUP BY day)
  SELECT jsonb_build_object(
    'stages', (SELECT to_jsonb(s) FROM stages s),
    'avgCheckoutSeconds', COALESCE((SELECT round(avg(secs)) FROM durations), 0),
    'daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'visits', d.visits,
        'addToCart', d.add_to_cart,
        'beginCheckout', d.begin_checkout,
        'purchases', d.purchases,
        'avgCheckoutSeconds', COALESCE(dd.avg_secs, 0)
      ) ORDER BY d.day)
      FROM daily d LEFT JOIN daily_dur dd ON dd.day = d.day
    ), '[]'::jsonb)
  );
$function$;

CREATE OR REPLACE FUNCTION public.mkt_cidade_options()
 RETURNS TABLE(value text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT btrim(pe.cidade) AS value
  FROM public.product_events pe
  WHERE pe.cidade IS NOT NULL AND btrim(pe.cidade) <> ''
  GROUP BY 1
  ORDER BY 1;
$function$;