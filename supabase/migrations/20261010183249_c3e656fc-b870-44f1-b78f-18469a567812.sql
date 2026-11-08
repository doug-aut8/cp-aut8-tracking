CREATE OR REPLACE FUNCTION public.mkt_sales_summary(p_start timestamp with time zone, p_end timestamp with time zone, p_source text DEFAULT NULL::text, p_campaign text DEFAULT NULL::text, p_loc_field text DEFAULT NULL::text, p_loc_value text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH o AS (
    SELECT p.valor_total, p.subtotal, p.frete, p.desconto,
           CASE WHEN jsonb_typeof(p.itens::jsonb) = 'array' THEN p.itens::jsonb ELSE '[]'::jsonb END AS itens
    FROM public.pedidos_sabor_delivery p
    WHERE p.data_criacao >= p_start AND p.data_criacao <= p_end
      AND p.status_atual IS DISTINCT FROM 'cancelled'
      AND COALESCE(p.valor_total, 0) > 0
      AND (p_source IS NULL OR p.utm_source = p_source)
      AND (p_campaign IS NULL OR p.utm_campaign = p_campaign)
      AND (p_loc_value IS NULL OR
           (p_loc_field = 'cidade' AND p.cidade = p_loc_value) OR
           (p_loc_field = 'bairro' AND p.bairro = p_loc_value))
  ),
  agg AS (
    SELECT count(*)::bigint AS order_count,
      COALESCE(sum(valor_total), 0) AS revenue,
      COALESCE(sum(COALESCE(subtotal, GREATEST(COALESCE(valor_total,0) - COALESCE(frete,0), 0))), 0) AS products,
      COALESCE(sum(COALESCE(frete, 0)), 0) AS freight,
      COALESCE(sum(COALESCE(desconto, 0)), 0) AS discount
    FROM o
  ),
  items AS (
    SELECT
      (COALESCE((i->>'isGift')::boolean, false)
        OR COALESCE(i->>'menuItemId', '') LIKE 'gift-%'
        OR i->>'category' = 'brinde') AS is_gift,
      COALESCE(NULLIF(i->>'quantity','')::numeric, NULLIF(i->>'quantidade','')::numeric, 1) AS qty,
      regexp_replace(COALESCE(i->>'giftProductId', i->>'menuItemId', i->>'id', ''), '^gift-', '') AS item_id,
      COALESCE(i->'selectedSize'->>'id', i->'combination'->'size'->>'id') AS size_id,
      lower(trim(COALESCE(i->'selectedSize'->>'name', i->'combination'->'size'->>'name', i->'combination'->>'tamanho'))) AS size_name,
      NULLIF(i->'selectedSize'->>'cost','')::numeric AS stored_size_cost
    FROM o, jsonb_array_elements(o.itens) i
  ),
  priced AS (
    SELECT it.is_gift, it.qty, m.price,
      COALESCE(
        NULLIF(it.stored_size_cost, 0),
        (SELECT NULLIF(NULLIF(s->>'cost','')::numeric, 0)
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.pizza_sizes) = 'array' THEN m.pizza_sizes ELSE '[]'::jsonb END) s
          WHERE (it.size_id IS NOT NULL AND s->>'id' = it.size_id)
             OR (it.size_name IS NOT NULL AND lower(trim(s->>'name')) = it.size_name)
          LIMIT 1),
        m.cost, 0) AS unit_cost
    FROM items it LEFT JOIN public.menu_items m ON m.id::text = it.item_id AND it.item_id <> ''
  ),
  ic AS (
    SELECT
      COALESCE(sum(qty) FILTER (WHERE NOT is_gift), 0) AS total_items,
      COALESCE(sum(qty * COALESCE(price, 0)) FILTER (WHERE is_gift), 0) AS gift_value,
      COALESCE(sum(qty * unit_cost) FILTER (WHERE is_gift), 0) AS gift_cost,
      COALESCE(sum(qty * unit_cost) FILTER (WHERE NOT is_gift), 0) AS product_cost
    FROM priced
  )
  SELECT jsonb_build_object(
    'orderCount', a.order_count,
    'totalRevenue', a.revenue,
    'totalProducts', a.products,
    'totalFreight', a.freight,
    'totalDiscount', a.discount + ic.gift_value,
    'totalItems', ic.total_items,
    'totalProductCost', ic.product_cost,
    'totalGiftCost', ic.gift_cost
  ) FROM agg a, ic;
$function$;