ALTER TABLE public.product_events
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS browser text;
ALTER TABLE public.pedidos_sabor_delivery
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS os text,
  ADD COLUMN IF NOT EXISTS browser text;

CREATE OR REPLACE FUNCTION public.mkt_device_breakdown(p_start timestamptz, p_end timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  WITH s AS (
    SELECT DISTINCT ON (session_id) session_id, COALESCE(device_type,'desconhecido') d,
      COALESCE(os,'desconhecido') o, COALESCE(browser,'desconhecido') b
    FROM product_events
    WHERE created_at BETWEEN p_start AND p_end AND session_id IS NOT NULL
    ORDER BY session_id, created_at
  ), o AS (
    SELECT COALESCE(device_type,'desconhecido') d, COALESCE(os,'desconhecido') os_, COALESCE(browser,'desconhecido') b,
      COALESCE(valor_total,0) v
    FROM pedidos_sabor_delivery
    WHERE criado_em BETWEEN p_start AND p_end
      AND COALESCE(status_atual,'') <> 'cancelled' AND COALESCE(valor_total,0) > 0
  ), dims AS (
    SELECT 'device' kind, d val, count(*) sessions FROM s GROUP BY d
    UNION ALL SELECT 'os', o, count(*) FROM s GROUP BY o
    UNION ALL SELECT 'browser', b, count(*) FROM s GROUP BY b
  ), ords AS (
    SELECT 'device' kind, d val, count(*) orders, sum(v) revenue FROM o GROUP BY d
    UNION ALL SELECT 'os', os_, count(*), sum(v) FROM o GROUP BY os_
    UNION ALL SELECT 'browser', b, count(*), sum(v) FROM o GROUP BY b
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'kind', COALESCE(dims.kind, ords.kind), 'value', COALESCE(dims.val, ords.val),
    'sessions', COALESCE(dims.sessions,0), 'orders', COALESCE(ords.orders,0),
    'revenue', COALESCE(ords.revenue,0))), '[]'::jsonb)
  INTO r
  FROM dims FULL OUTER JOIN ords ON dims.kind = ords.kind AND dims.val = ords.val;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.mkt_device_breakdown(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mkt_device_breakdown(timestamptz, timestamptz) TO authenticated, service_role;