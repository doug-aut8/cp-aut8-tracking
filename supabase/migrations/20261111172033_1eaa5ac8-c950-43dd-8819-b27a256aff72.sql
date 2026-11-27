CREATE OR REPLACE FUNCTION public.mkt_device_breakdown(p_start timestamptz, p_end timestamptz, p_source text DEFAULT NULL, p_campaign text DEFAULT NULL, p_loc_field text DEFAULT NULL, p_loc_value text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'not allowed'; END IF;
  WITH s AS (
    SELECT DISTINCT ON (session_id) session_id, COALESCE(device_type,'desconhecido') d,
      COALESCE(os,'desconhecido') o, COALESCE(browser,'desconhecido') b
    FROM product_events
    WHERE created_at BETWEEN p_start AND p_end AND session_id IS NOT NULL
      AND (p_source IS NULL OR utm_source = p_source)
      AND (p_campaign IS NULL OR utm_campaign = p_campaign)
      AND (p_loc_value IS NULL OR p_loc_field <> 'cidade' OR cidade = p_loc_value)
    ORDER BY session_id, created_at
  ), o AS (
    SELECT COALESCE(device_type,'desconhecido') d, COALESCE(os,'desconhecido') os_, COALESCE(browser,'desconhecido') b, COALESCE(valor_total,0) v
    FROM pedidos_sabor_delivery
    WHERE criado_em BETWEEN p_start AND p_end
      AND COALESCE(status_atual,'') <> 'cancelled' AND COALESCE(valor_total,0) > 0
      AND (p_source IS NULL OR utm_source = p_source)
      AND (p_campaign IS NULL OR utm_campaign = p_campaign)
      AND (p_loc_value IS NULL OR (p_loc_field = 'cidade' AND cidade = p_loc_value) OR (p_loc_field = 'bairro' AND bairro = p_loc_value))
  ), dims AS (
    SELECT 'device' kind, d val, count(*) sessions FROM s GROUP BY d
    UNION ALL SELECT 'os', o, count(*) FROM s GROUP BY o
    UNION ALL SELECT 'browser', b, count(*) FROM s GROUP BY b
  ), ords AS (
    SELECT 'device' kind, d val, count(*) orders, sum(v) revenue FROM o GROUP BY d
    UNION ALL SELECT 'os', os_, count(*), sum(v) FROM o GROUP BY os_
    UNION ALL SELECT 'browser', b, count(*), sum(v) FROM o GROUP BY b
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('kind', COALESCE(dims.kind, ords.kind), 'value', COALESCE(dims.val, ords.val),
    'sessions', COALESCE(dims.sessions,0), 'orders', COALESCE(ords.orders,0), 'revenue', COALESCE(ords.revenue,0))), '[]'::jsonb)
  INTO r FROM dims FULL OUTER JOIN ords ON dims.kind = ords.kind AND dims.val = ords.val;
  RETURN r;
END $$;
DROP FUNCTION IF EXISTS public.mkt_device_breakdown(timestamptz, timestamptz);
REVOKE ALL ON FUNCTION public.mkt_device_breakdown(timestamptz, timestamptz, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_device_breakdown(timestamptz, timestamptz, text, text, text, text) TO authenticated, service_role;