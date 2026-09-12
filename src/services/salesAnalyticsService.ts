import { supabase } from "@/integrations/supabase/client";
import { cachedFetch } from "@/services/queryCache";

type SalesOrderRow = {
  data_criacao: string | null;
  valor_total: number | null;
  status_atual: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_medium?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

const buildUtcRangeFromLocalDates = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

const fetchSalesOrders = async <T extends SalesOrderRow>(
  startDate: string,
  endDate: string,
  select: string,
): Promise<T[]> => {
  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  const rows = await cachedFetch(`orders|${select}|${startIso}|${endIso}`, async () => {
    const { data, error } = await supabase
      .from("pedidos_sabor_delivery" as any)
      .select(select)
      .gte("data_criacao", startIso)
      .lte("data_criacao", endIso)
      .neq("status_atual", "cancelled");

    if (error) throw new Error(error.message);
    return (data ?? []) as unknown[];
  });

  return rows as T[];
};

// ---- Brindes (fidelidade / cupom "compre e ganhe") ----
// Itens com isGift=true (ou menuItemId começando com "gift-") não contam como
// item vendido; o valor do item em menu_items é somado aos descontos.

export const isGiftItem = (item: any): boolean =>
  !!item?.isGift ||
  (typeof item?.menuItemId === "string" && item.menuItemId.startsWith("gift-")) ||
  item?.category === "brinde";

// Coleta os ids de menu_items referenciados pelos brindes de uma lista de pedidos
const collectGiftMenuItemIds = (rows: Array<{ itens: unknown }>): string[] => {
  const ids = new Set<string>();
  rows.forEach((row) => {
    if (!Array.isArray(row.itens)) return;
    (row.itens as any[]).forEach((item) => {
      if (!isGiftItem(item)) return;
      const rawId = item?.giftProductId ?? item?.menuItemId ?? item?.id ?? null;
      if (!rawId) return;
      // menuItemId pode vir como "gift-<id-do-item>"
      const id = String(rawId).replace(/^gift-/, "");
      if (id) ids.add(id);
    });
  });
  return Array.from(ids);
};

// Busca os preços e custos dos itens de menu referenciados pelos brindes/cálculos
const fetchMenuItemPricesAndCosts = async (ids: string[]): Promise<{ prices: Map<string, number>; costs: Map<string, number> }> => {
  const prices = new Map<string, number>();
  const costs = new Map<string, number>();
  if (ids.length === 0) return { prices, costs };

  const { data, error } = await cachedFetch(
    `menu_items|price_cost|${[...ids].sort().join(",")}`,
    async () =>
      await supabase
        .from("menu_items" as any)
        .select("id, price, cost")
        .in("id", ids),
    5 * 60_000,
  );

  if (error) {
    console.error("Erro ao buscar preços/custos de itens:", error);
    return { prices, costs };
  }

  ((data ?? []) as any[]).forEach((row) => {
    const id = String(row.id);
    prices.set(id, Number(row.price ?? 0));
    costs.set(id, Number(row.cost ?? 0));
  });
  return { prices, costs };
};

// Valor de um brinde: preço do item em menu_items * quantidade
const giftItemValue = (item: any, prices: Map<string, number>): number => {
  const rawId = item?.giftProductId ?? item?.menuItemId ?? item?.id ?? null;
  if (!rawId) return 0;
  const id = String(rawId).replace(/^gift-/, "");
  const price = prices.get(id) ?? 0;
  const qty = Number(item?.quantity ?? item?.quantidade ?? 1);
  return price * qty;
};

// ---- Sales heatmap by day/hour ----
export interface SalesHeatmapRow {
  dayOfWeek: number;
  hour: number;
  orders: number;
  revenue: number;
}

export const fetchSalesHeatmap = async (startDate: string, endDate: string): Promise<SalesHeatmapRow[]> => {
  const data = await fetchSalesOrders(startDate, endDate, "data_criacao, valor_total, status_atual");

  const grid: { orders: number; revenue: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ orders: 0, revenue: 0 })),
  );

  data.forEach((row) => {
    if (!row.data_criacao) return;

    const d = new Date(row.data_criacao);
    if (isNaN(d.getTime())) return;

    const day = d.getDay();
    const hour = d.getHours();
    grid[day][hour].orders += 1;
    grid[day][hour].revenue += Number(row.valor_total || 0);
  });

  const result: SalesHeatmapRow[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      if (grid[day][hour].orders > 0) {
        result.push({ dayOfWeek: day, hour, ...grid[day][hour] });
      }
    }
  }

  return result;
};

// ---- Sales by UTM source ----
export interface SalesBySourceRow {
  source: string;
  orders: number;
  revenue: number;
}

export const fetchSalesBySource = async (startDate: string, endDate: string): Promise<SalesBySourceRow[]> => {
  const data = await fetchSalesOrders(startDate, endDate, "data_criacao, utm_source, valor_total, status_atual");

  const map = new Map<string, { orders: number; revenue: number }>();
  data.forEach((row) => {
    const source = row.utm_source || "(direto)";
    const existing = map.get(source) || { orders: 0, revenue: 0 };
    map.set(source, {
      orders: existing.orders + 1,
      revenue: existing.revenue + Number(row.valor_total || 0),
    });
  });

  return Array.from(map.entries())
    .map(([source, value]) => ({ source, ...value }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
};

// ---- Sales by UTM campaign ----
export interface SalesByCampaignRow {
  campaign: string;
  orders: number;
  revenue: number;
}

export const fetchSalesByCampaign = async (startDate: string, endDate: string): Promise<SalesByCampaignRow[]> => {
  const data = await fetchSalesOrders(startDate, endDate, "data_criacao, utm_campaign, valor_total, status_atual");

  const map = new Map<string, { orders: number; revenue: number }>();
  data.forEach((row) => {
    const campaign = row.utm_campaign?.trim();
    if (!campaign) return;

    const existing = map.get(campaign) || { orders: 0, revenue: 0 };
    map.set(campaign, {
      orders: existing.orders + 1,
      revenue: existing.revenue + Number(row.valor_total || 0),
    });
  });

  return Array.from(map.entries())
    .map(([campaign, value]) => ({ campaign, ...value }))
    .sort((a, b) => b.revenue - a.revenue)
  .slice(0, 10);
};

// ---- Source detail: items sold from a specific utm_source ----
export interface SourceItemRow {
  name: string;
  quantitySold: number;
  revenue: number;
}

export const fetchSourceDetail = async (
  startDate: string,
  endDate: string,
  source: string,
): Promise<SourceItemRow[]> => {
  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  const query = supabase
    .from("pedidos_sabor_delivery" as any)
    .select("itens, valor_total, status_atual, data_criacao, utm_source")
    .gte("data_criacao", startIso)
    .lte("data_criacao", endIso)
    .neq("status_atual", "cancelled");

  // "(direto)" means null utm_source
  const { data, error } = source === "(direto)"
    ? await query.is("utm_source", null)
    : await query.eq("utm_source", source);

  if (error) throw new Error(error.message);

  const map = new Map<string, { quantitySold: number; revenue: number }>();

  ((data ?? []) as any[]).forEach((order) => {
    const items = order.itens;
    if (!Array.isArray(items)) return;

    items.forEach((item: any) => {
      if (isGiftItem(item)) return; // brindes não contam como item vendido
      const name = item.name || item.nome || "Sem nome";
      const qty = Number(item.quantity || item.quantidade || 1);
      const subtotal = Number(item.subtotal || item.price || item.preco || 0) * (item.subtotal ? 1 : qty);

      const existing = map.get(name) || { quantitySold: 0, revenue: 0 };
      map.set(name, {
        quantitySold: existing.quantitySold + qty,
        revenue: existing.revenue + subtotal,
      });
    });
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.revenue - a.revenue);
};

// ---- Campaign detail: items sold in a specific campaign ----
export interface CampaignItemRow {
  name: string;
  quantitySold: number;
  revenue: number;
}

export const fetchCampaignDetail = async (
  startDate: string,
  endDate: string,
  campaign: string,
): Promise<CampaignItemRow[]> => {
  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  const { data, error } = await cachedFetch(
    `orders|campaign_detail|${startIso}|${endIso}|${campaign}`,
    async () =>
      await supabase
        .from("pedidos_sabor_delivery" as any)
        .select("itens, valor_total, status_atual, data_criacao, utm_campaign")
        .gte("data_criacao", startIso)
        .lte("data_criacao", endIso)
        .neq("status_atual", "cancelled")
        .eq("utm_campaign", campaign),
  );

  if (error) throw new Error(error.message);

  const map = new Map<string, { quantitySold: number; revenue: number }>();

  ((data ?? []) as any[]).forEach((order) => {
    const items = order.itens;
    if (!Array.isArray(items)) return;

    items.forEach((item: any) => {
      if (isGiftItem(item)) return; // brindes não contam como item vendido
      const name = item.name || item.nome || "Sem nome";
      const qty = Number(item.quantity || item.quantidade || 1);
      const subtotal = Number(item.subtotal || item.price || item.preco || 0) * (item.subtotal ? 1 : qty);

      const existing = map.get(name) || { quantitySold: 0, revenue: 0 };
      map.set(name, {
        quantitySold: existing.quantitySold + qty,
        revenue: existing.revenue + subtotal,
      });
    });
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.revenue - a.revenue);
};

// ---- Item performance (funil de itens) ----
export interface ItemPerformanceRow {
  name: string;
  quantitySold: number;
  revenue: number;
}

export const fetchItemPerformance = async (startDate: string, endDate: string): Promise<ItemPerformanceRow[]> => {
  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  const { data, error } = await cachedFetch(
    `orders|item_performance|${startIso}|${endIso}`,
    async () =>
      await supabase
        .from("pedidos_sabor_delivery" as any)
        .select("itens, valor_total, status_atual, data_criacao")
        .gte("data_criacao", startIso)
        .lte("data_criacao", endIso)
        .neq("status_atual", "cancelled"),
  );

  if (error) throw new Error(error.message);

  const map = new Map<string, { quantitySold: number; revenue: number }>();

  ((data ?? []) as any[]).forEach((order) => {
    const items = order.itens;
    if (!Array.isArray(items)) return;

    items.forEach((item: any) => {
      if (isGiftItem(item)) return; // brindes não contam como item vendido
      const name = item.name || item.nome || "Sem nome";
      const qty = Number(item.quantity || item.quantidade || 1);
      const subtotal = Number(item.subtotal || item.price || item.preco || 0) * (item.subtotal ? 1 : qty);

      const existing = map.get(name) || { quantitySold: 0, revenue: 0 };
      map.set(name, {
        quantitySold: existing.quantitySold + qty,
        revenue: existing.revenue + subtotal,
      });
    });
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.revenue - a.revenue);
};

// ---- Sales by UTM medium ----
export interface SalesByMediumRow {
  medium: string;
  orders: number;
  revenue: number;
}

export const fetchSalesByMedium = async (startDate: string, endDate: string): Promise<SalesByMediumRow[]> => {
  const data = await fetchSalesOrders(startDate, endDate, "data_criacao, utm_medium, valor_total, status_atual");

  const map = new Map<string, { orders: number; revenue: number }>();
  data.forEach((row) => {
    const medium = row.utm_medium?.trim();
    if (!medium) return;

    const existing = map.get(medium) || { orders: 0, revenue: 0 };
    map.set(medium, {
      orders: existing.orders + 1,
      revenue: existing.revenue + Number(row.valor_total || 0),
    });
  });

  return Array.from(map.entries())
    .map(([medium, value]) => ({ medium, ...value }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
};

// ---- Sales by UTM content ----
export interface SalesByContentRow {
  content: string;
  orders: number;
  revenue: number;
}

export const fetchSalesByContent = async (startDate: string, endDate: string): Promise<SalesByContentRow[]> => {
  const data = await fetchSalesOrders(startDate, endDate, "data_criacao, utm_content, valor_total, status_atual");

  const map = new Map<string, { orders: number; revenue: number }>();
  data.forEach((row) => {
    const content = row.utm_content?.trim();
    if (!content) return;

    const existing = map.get(content) || { orders: 0, revenue: 0 };
    map.set(content, {
      orders: existing.orders + 1,
      revenue: existing.revenue + Number(row.valor_total || 0),
    });
  });

  return Array.from(map.entries())
    .map(([content, value]) => ({ content, ...value }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
};

// ---- Sales by UTM term ----
export interface SalesByTermRow {
  term: string;
  orders: number;
  revenue: number;
}

export const fetchSalesByTerm = async (startDate: string, endDate: string): Promise<SalesByTermRow[]> => {
  const data = await fetchSalesOrders(startDate, endDate, "data_criacao, utm_term, valor_total, status_atual");

  const map = new Map<string, { orders: number; revenue: number }>();
  data.forEach((row) => {
    const term = row.utm_term?.trim();
    if (!term) return;

    const existing = map.get(term) || { orders: 0, revenue: 0 };
    map.set(term, {
      orders: existing.orders + 1,
      revenue: existing.revenue + Number(row.valor_total || 0),
    });
  });

  return Array.from(map.entries())
    .map(([term, value]) => ({ term, ...value }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
};

// ---- Sales summary (cards do painel "Vendas") ----
export interface SalesSummary {
  orderCount: number;
  totalRevenue: number;
  avgTicketProducts: number;
  avgTicketFreight: number;
  totalFreight: number;
  totalDiscount: number;
  itemsPerOrder: number;
  totalProductCost: number;
  totalGiftCost: number;
  totalCost: number;
}

export const fetchSalesSummary = async (
  startDate: string,
  endDate: string,
  sourceFilter?: string | null,
  campaignFilter?: string | null,
): Promise<SalesSummary> => {
  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  const { data, error } = await cachedFetch(
    `orders|summary|${startIso}|${endIso}|${sourceFilter ?? ""}|${campaignFilter ?? ""}`,
    async () => {
      let query = supabase
        .from("pedidos_sabor_delivery" as any)
        .select("valor_total, subtotal, frete, desconto, itens, status_atual, utm_source, utm_campaign")
        .gte("data_criacao", startIso)
        .lte("data_criacao", endIso)
        .neq("status_atual", "cancelled");

      if (sourceFilter) query = query.eq("utm_source", sourceFilter);
      if (campaignFilter) query = query.eq("utm_campaign", campaignFilter);
      return await query;
    },
  );
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<{
    valor_total: number | null;
    subtotal: number | null;
    frete: number | null;
    desconto: number | null;
    itens: unknown;
  }>;

  const valid = rows.filter((r) => (r.valor_total ?? 0) > 0);
  const orderCount = valid.length;
  const totalRevenue = valid.reduce((s, r) => s + (r.valor_total ?? 0), 0);
  const totalProducts = valid.reduce(
    (s, r) => s + (r.subtotal ?? Math.max((r.valor_total ?? 0) - (r.frete ?? 0), 0)),
    0,
  );
  const totalFreight = valid.reduce((s, r) => s + (r.frete ?? 0), 0);

  // Brindes: busca o preço em menu_items para somar aos descontos
  const { prices: giftPrices, costs: menuItemCosts } = await fetchMenuItemPricesAndCosts(collectGiftMenuItemIds(valid));

  const totalDiscount = valid.reduce((s, r) => {
    let giftValue = 0;
    if (Array.isArray(r.itens)) {
      giftValue = (r.itens as any[]).reduce(
        (acc, item) => (isGiftItem(item) ? acc + giftItemValue(item, giftPrices) : acc),
        0,
      );
    }
    return s + (r.desconto ?? 0) + giftValue;
  }, 0);

  const totalItems = valid.reduce((s, r) => {
    if (!Array.isArray(r.itens)) return s;
    return (
      s +
      (r.itens as any[]).reduce(
        (acc: number, item: any) =>
          isGiftItem(item) ? acc : acc + Number(item?.quantity ?? item?.quantidade ?? 1),
        0,
      )
    );
  }, 0);

  // Custo dos produtos vendidos (CMV) e dos brindes
  const resolveItemCost = (item: any): number => {
    const rawId = item?.giftProductId ?? item?.menuItemId ?? item?.id ?? null;
    if (!rawId) return 0;
    const id = String(rawId).replace(/^gift-/, "");
    return menuItemCosts.get(id) ?? 0;
  };

  let totalProductCost = 0;
  let totalGiftCost = 0;
  valid.forEach((r) => {
    if (!Array.isArray(r.itens)) return;
    (r.itens as any[]).forEach((item) => {
      const qty = Number(item?.quantity ?? item?.quantidade ?? 1);
      const cost = resolveItemCost(item) * qty;
      if (isGiftItem(item)) {
        totalGiftCost += cost;
      } else {
        totalProductCost += cost;
      }
    });
  });

  const totalCost = totalProductCost + totalGiftCost + totalFreight;

  return {
    orderCount,
    totalRevenue,
    avgTicketProducts: orderCount > 0 ? totalProducts / orderCount : 0,
    avgTicketFreight: orderCount > 0 ? totalFreight / orderCount : 0,
    totalFreight,
    totalDiscount,
    itemsPerOrder: orderCount > 0 ? totalItems / orderCount : 0,
    totalProductCost,
    totalGiftCost,
    totalCost,
  };
};

// ---- Sessões únicas (product_events) no período ----
// Usada na Taxa de Conversão = pedidos concluídos / sessões únicas * 100.
export const fetchUniqueSessions = async (
  startDate: string,
  endDate: string,
  sourceFilter?: string | null,
  campaignFilter?: string | null,
): Promise<number> => {
  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  // Uma única chamada RPC agrega no banco (antes eram N requisições paginadas)
  const count = await cachedFetch(
    `unique_sessions|${startIso}|${endIso}|${sourceFilter ?? ""}|${campaignFilter ?? ""}`,
    async () => {
      const { data, error } = await supabase.rpc("mkt_unique_sessions" as any, {
        p_start: startIso,
        p_end: endIso,
        p_source: sourceFilter ?? null,
        p_campaign: campaignFilter ?? null,
      });
      if (error) throw new Error(error.message);
      return Number(data ?? 0);
    },
  );

  return count;
};


// ---- Série diária de métricas de vendas (gráfico da aba "Vendas") ----
export type DailySalesMetricKey =
  | "totalRevenue"
  | "orderCount"
  | "avgTicketProducts"
  | "totalFreight"
  | "avgTicketFreight"
  | "totalDiscount"
  | "itemsPerOrder"
  | "convTimeSeconds";

export interface DailySalesMetricRow {
  date: string; // yyyy-MM-dd (data local)
  value: number;
}

const toLocalDateKey = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const enumerateDays = (startDate: string, endDate: string): string[] => {
  const days: string[] = [];
  const d = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (d <= end) {
    days.push(toLocalDateKey(d.toISOString()) as string);
    d.setDate(d.getDate() + 1);
  }
  return days;
};

export const fetchDailySalesMetrics = async (
  startDate: string,
  endDate: string,
  metric: DailySalesMetricKey,
  sourceFilter?: string | null,
  campaignFilter?: string | null,
): Promise<DailySalesMetricRow[]> => {
  const days = enumerateDays(startDate, endDate);

  if (metric === "convTimeSeconds") {
    const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

    let checkoutQuery = supabase
      .from("checkout_events" as any)
      .select("session_id, created_at, utm_source, utm_campaign")
      .eq("event_type", "checkout_advance")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .not("session_id", "is", null);

    if (sourceFilter) checkoutQuery = checkoutQuery.eq("utm_source", sourceFilter);
    if (campaignFilter) checkoutQuery = checkoutQuery.eq("utm_campaign", campaignFilter);

    const { data: checkoutData, error: checkoutError } = await checkoutQuery;
    if (checkoutError) throw new Error(checkoutError.message);

    const firstAdvanceBySession = new Map<string, number>();
    ((checkoutData ?? []) as any[]).forEach((row) => {
      if (!row.session_id || !row.created_at) return;
      const t = new Date(row.created_at).getTime();
      if (isNaN(t)) return;
      const existing = firstAdvanceBySession.get(row.session_id);
      if (existing === undefined || t < existing) firstAdvanceBySession.set(row.session_id, t);
    });

    if (firstAdvanceBySession.size === 0) return days.map((date) => ({ date, value: 0 }));

    const sessionIds = Array.from(firstAdvanceBySession.keys()).slice(0, 500);
    const { data: eventsData, error: eventsError } = await supabase
      .from("product_events" as any)
      .select("session_id, created_at")
      .in("session_id", sessionIds)
      .lte("created_at", endIso)
      .not("session_id", "is", null);

    if (eventsError) throw new Error(eventsError.message);

    const firstEventBySession = new Map<string, number>();
    ((eventsData ?? []) as any[]).forEach((row) => {
      if (!row.session_id || !row.created_at) return;
      const t = new Date(row.created_at).getTime();
      if (isNaN(t)) return;
      const existing = firstEventBySession.get(row.session_id);
      if (existing === undefined || t < existing) firstEventBySession.set(row.session_id, t);
    });

    const sumByDay = new Map<string, { sum: number; count: number }>();
    firstAdvanceBySession.forEach((advanceAt, sessionId) => {
      const firstAt = firstEventBySession.get(sessionId);
      if (firstAt === undefined) return;
      const diff = (advanceAt - firstAt) / 1000;
      if (diff < 0) return;
      const day = toLocalDateKey(new Date(advanceAt).toISOString());
      if (!day) return;
      const agg = sumByDay.get(day) ?? { sum: 0, count: 0 };
      agg.sum += diff;
      agg.count += 1;
      sumByDay.set(day, agg);
    });

    return days.map((date) => {
      const agg = sumByDay.get(date);
      return { date, value: agg && agg.count > 0 ? agg.sum / agg.count : 0 };
    });
  }

  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  const { data, error } = await cachedFetch(
    `orders|daily_sales|${startIso}|${endIso}|${sourceFilter ?? ""}|${campaignFilter ?? ""}`,
    async () => {
      let query = supabase
        .from("pedidos_sabor_delivery" as any)
        .select("data_criacao, valor_total, subtotal, frete, desconto, itens, status_atual, utm_source, utm_campaign")
        .gte("data_criacao", startIso)
        .lte("data_criacao", endIso)
        .neq("status_atual", "cancelled");

      if (sourceFilter) query = query.eq("utm_source", sourceFilter);
      if (campaignFilter) query = query.eq("utm_campaign", campaignFilter);
      return await query;
    },
  );
  if (error) throw new Error(error.message);

  const byDay = new Map<
    string,
    { orders: number; revenue: number; products: number; freight: number; discount: number; items: number }
  >();

  ((data ?? []) as any[]).forEach((row) => {
    if (!row.data_criacao || (row.valor_total ?? 0) <= 0) return;
    const day = toLocalDateKey(row.data_criacao);
    if (!day) return;
    const agg =
      byDay.get(day) ?? { orders: 0, revenue: 0, products: 0, freight: 0, discount: 0, items: 0 };
    const frete = Number(row.frete ?? 0);
    const total = Number(row.valor_total ?? 0);
    agg.orders += 1;
    agg.revenue += total;
    agg.products += Number(row.subtotal ?? Math.max(total - frete, 0));
    agg.freight += frete;
    agg.discount += Number(row.desconto ?? 0);
    if (Array.isArray(row.itens)) {
      agg.items += row.itens.reduce(
        (acc: number, item: any) => acc + Number(item?.quantity ?? item?.quantidade ?? 1),
        0,
      );
    }
    byDay.set(day, agg);
  });

  return days.map((date) => {
    const agg = byDay.get(date);
    if (!agg) return { date, value: 0 };
    switch (metric) {
      case "totalRevenue":
        return { date, value: agg.revenue };
      case "orderCount":
        return { date, value: agg.orders };
      case "avgTicketProducts":
        return { date, value: agg.orders > 0 ? agg.products / agg.orders : 0 };
      case "totalFreight":
        return { date, value: agg.freight };
      case "avgTicketFreight":
        return { date, value: agg.orders > 0 ? agg.freight / agg.orders : 0 };
      case "totalDiscount":
        return { date, value: agg.discount };
      case "itemsPerOrder":
        return { date, value: agg.orders > 0 ? agg.items / agg.orders : 0 };
      default:
        return { date, value: 0 };
    }
  });
};

// ---- Tempo médio até a conversão ----
// Para cada sessão que chegou ao checkout (evento "checkout_advance" em
// checkout_events), mede o tempo entre o primeiro evento registrado da sessão
// em product_events e o primeiro checkout_advance. Retorna a média em segundos.
export const fetchAvgConversionTimeSeconds = async (
  startDate: string,
  endDate: string,
  sourceFilter?: string | null,
  campaignFilter?: string | null,
): Promise<number | null> => {
  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  const checkoutData = await cachedFetch(
    `checkout_advance|${startIso}|${endIso}|${sourceFilter ?? ""}|${campaignFilter ?? ""}`,
    async () => {
      let checkoutQuery = supabase
        .from("checkout_events" as any)
        .select("session_id, created_at, utm_source, utm_campaign")
        .eq("event_type", "checkout_advance")
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .not("session_id", "is", null);

      if (sourceFilter) checkoutQuery = checkoutQuery.eq("utm_source", sourceFilter);
      if (campaignFilter) checkoutQuery = checkoutQuery.eq("utm_campaign", campaignFilter);

      const { data, error } = await checkoutQuery;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown[];
    },
  );


  const firstAdvanceBySession = new Map<string, number>();
  ((checkoutData ?? []) as any[]).forEach((row) => {
    if (!row.session_id || !row.created_at) return;
    const t = new Date(row.created_at).getTime();
    if (isNaN(t)) return;
    const existing = firstAdvanceBySession.get(row.session_id);
    if (existing === undefined || t < existing) firstAdvanceBySession.set(row.session_id, t);
  });

  if (firstAdvanceBySession.size === 0) return null;

  // Limita a quantidade de sessões para não estourar o tamanho da query
  const sessionIds = Array.from(firstAdvanceBySession.keys()).slice(0, 500);

  const eventsData = await cachedFetch(
    `conv_first_events|${endIso}|${sessionIds.length}|${sessionIds[0] ?? ""}|${sessionIds[sessionIds.length - 1] ?? ""}`,
    async () => {
      const { data, error } = await supabase
        .from("product_events" as any)
        .select("session_id, created_at")
        .in("session_id", sessionIds)
        .lte("created_at", endIso)
        .not("session_id", "is", null);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  );

  const firstEventBySession = new Map<string, number>();
  ((eventsData ?? []) as any[]).forEach((row) => {
    if (!row.session_id || !row.created_at) return;
    const t = new Date(row.created_at).getTime();
    if (isNaN(t)) return;
    const existing = firstEventBySession.get(row.session_id);
    if (existing === undefined || t < existing) firstEventBySession.set(row.session_id, t);
  });

  let sum = 0;
  let count = 0;
  firstAdvanceBySession.forEach((advanceAt, sessionId) => {
    const firstAt = firstEventBySession.get(sessionId);
    if (firstAt === undefined) return;
    const diff = (advanceAt - firstAt) / 1000;
    if (diff < 0) return;
    sum += diff;
    count += 1;
  });

  return count > 0 ? sum / count : null;
};

// ---- Detalhamento da "Quantidade de Vendas" ----
export interface OrderCountTopDay {
  date: string; // yyyy-MM-dd
  orders: number;
}

export interface OrderCountTopProduct {
  quantity: number;
  category: string;
  name: string;
  size: string | null;
  revenue: number;
}

export interface OrderCountDetail {
  totalOrders: number;
  topDays: OrderCountTopDay[];
  topProducts: OrderCountTopProduct[];
}

export const fetchOrderCountDetail = async (
  startDate: string,
  endDate: string,
  sourceFilter?: string | null,
  campaignFilter?: string | null,
): Promise<OrderCountDetail> => {
  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  const { data, error } = await cachedFetch(
    `orders|count_detail|${startIso}|${endIso}|${sourceFilter ?? ""}|${campaignFilter ?? ""}`,
    async () => {
      let query = supabase
        .from("pedidos_sabor_delivery" as any)
        .select("data_criacao, valor_total, itens, status_atual, utm_source, utm_campaign")
        .gte("data_criacao", startIso)
        .lte("data_criacao", endIso)
        .neq("status_atual", "cancelled");

      if (sourceFilter) query = query.eq("utm_source", sourceFilter);
      if (campaignFilter) query = query.eq("utm_campaign", campaignFilter);
      return await query;
    },
  );
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as any[]).filter((r) => Number(r.valor_total ?? 0) > 0);

  // Total de pedidos
  const totalOrders = rows.length;

  // Pedidos por dia (data local)
  const perDay = new Map<string, number>();
  rows.forEach((r) => {
    if (!r.data_criacao) return;
    const d = new Date(r.data_criacao);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  });

  const topDays = Array.from(perDay.entries())
    .map(([date, orders]) => ({ date, orders }))
    .sort((a, b) => b.orders - a.orders || (a.date < b.date ? -1 : 1))
    .slice(0, 3);

  // Produtos mais vendidos (agrupados por item + tamanho)
  type Agg = { quantity: number; revenue: number; name: string; size: string | null; menuItemId: string | null };
  const products = new Map<string, Agg>();

  rows.forEach((r) => {
    if (!Array.isArray(r.itens)) return;
    (r.itens as any[]).forEach((item) => {
      if (isGiftItem(item)) return;
      const name = item?.name || item?.nome || "Sem nome";
      const qty = Number(item?.quantity ?? item?.quantidade ?? 1) || 0;
      const size = item?.selectedSize?.name ? String(item.selectedSize.name) : null;
      const subtotal =
        item?.subtotal != null
          ? Number(item.subtotal)
          : Number(item?.price ?? item?.preco ?? 0) * qty;
      const menuItemId = item?.menuItemId != null ? String(item.menuItemId) : null;
      const key = `${menuItemId ?? name}__${size ?? ""}`;
      const existing = products.get(key);
      if (existing) {
        existing.quantity += qty;
        existing.revenue += subtotal;
      } else {
        products.set(key, { quantity: qty, revenue: subtotal, name, size, menuItemId });
      }
    });
  });

  const top = Array.from(products.values())
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 3);

  // Categoria de cada produto
  const ids = top.map((p) => p.menuItemId).filter((id): id is string => !!id);
  const categoryById = new Map<string, string>();
  if (ids.length > 0) {
    const { data: menuRows } = await cachedFetch(
      `menu_items|category|${[...ids].sort().join(",")}`,
      async () =>
        await supabase
          .from("menu_items" as any)
          .select("id, category")
          .in("id", ids),
      5 * 60_000,
    );
    ((menuRows ?? []) as any[]).forEach((row) => {
      categoryById.set(String(row.id), String(row.category ?? ""));
    });
  }

  const catIds = Array.from(new Set(Array.from(categoryById.values()).filter(Boolean)));
  const categoryNameById = new Map<string, string>();
  if (catIds.length > 0) {
    const { data: catRows } = await cachedFetch(
      `categories|name|${[...catIds].sort().join(",")}`,
      async () =>
        await supabase
          .from("categories" as any)
          .select("id, name")
          .in("id", catIds),
      5 * 60_000,
    );
    ((catRows ?? []) as any[]).forEach((row) => {
      categoryNameById.set(String(row.id), String(row.name ?? row.id));
    });
  }

  const topProducts: OrderCountTopProduct[] = top.map((p) => {
    const catId = p.menuItemId ? categoryById.get(p.menuItemId) ?? "" : "";
    return {
      quantity: p.quantity,
      category: catId ? categoryNameById.get(catId) ?? catId : "",
      name: p.name,
      size: p.size,
      revenue: p.revenue,
    };
  });

  return { totalOrders, topDays, topProducts };
};

// ---- Relatório completo de vendas ----
export interface SalesReportRow {
  id: string;
  dateIso: string;
  code: string;
  customer: string;
  itemCount: number;
  total: number;
}

export const fetchSalesReport = async (
  startDate: string,
  endDate: string,
  sourceFilter?: string | null,
  campaignFilter?: string | null,
): Promise<SalesReportRow[]> => {
  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  const { data, error } = await cachedFetch(
    `orders|report|${startIso}|${endIso}|${sourceFilter ?? ""}|${campaignFilter ?? ""}`,
    async () => {
      let query = supabase
        .from("pedidos_sabor_delivery" as any)
        .select("id, data_criacao, codigo_pedido, codigo_curto, nome_cliente, valor_total, itens, status_atual, utm_source, utm_campaign")
        .gte("data_criacao", startIso)
        .lte("data_criacao", endIso)
        .neq("status_atual", "cancelled")
        .order("data_criacao", { ascending: false });

      if (sourceFilter) query = query.eq("utm_source", sourceFilter);
      if (campaignFilter) query = query.eq("utm_campaign", campaignFilter);
      return await query;
    },
  );
  if (error) throw new Error(error.message);

  return ((data ?? []) as any[])
    .filter((r) => Number(r.valor_total ?? 0) > 0 && !!r.data_criacao)
    .map((r) => {
      const itens = Array.isArray(r.itens) ? (r.itens as any[]) : [];
      const itemCount = itens.reduce(
        (acc, item) => (isGiftItem(item) ? acc : acc + (Number(item?.quantity ?? item?.quantidade ?? 1) || 0)),
        0,
      );
      return {
        id: String(r.id),
        dateIso: String(r.data_criacao),
        code: String(r.codigo_pedido ?? r.codigo_curto ?? "—"),
        customer: String(r.nome_cliente ?? "—"),
        itemCount,
        total: Number(r.valor_total ?? 0),
      };
    });
};

// ---- Relatório completo de produtos vendidos ----
export interface ProductReportRow {
  monthKey: string; // yyyy-MM (data local)
  name: string;
  size: string | null;
  quantity: number;
  revenue: number;
  category: string;
  categoryId: string;
  menuItemId?: string | null;
  fallbackCategory?: string;
}

export const fetchProductsReport = async (
  startDate: string,
  endDate: string,
  sourceFilter?: string | null,
  campaignFilter?: string | null,
): Promise<ProductReportRow[]> => {
  const { startIso, endIso } = buildUtcRangeFromLocalDates(startDate, endDate);

  const { data, error } = await cachedFetch(
    `orders|products_report|${startIso}|${endIso}|${sourceFilter ?? ""}|${campaignFilter ?? ""}`,
    async () => {
      let query = supabase
        .from("pedidos_sabor_delivery" as any)
        .select("data_criacao, itens, valor_total, status_atual, utm_source, utm_campaign")
        .gte("data_criacao", startIso)
        .lte("data_criacao", endIso)
        .neq("status_atual", "cancelled");

      if (sourceFilter) query = query.eq("utm_source", sourceFilter);
      if (campaignFilter) query = query.eq("utm_campaign", campaignFilter);
      return await query;
    },
  );
  if (error) throw new Error(error.message);

  const agg = new Map<string, ProductReportRow>();

  ((data ?? []) as any[])
    .filter((r) => Number(r.valor_total ?? 0) > 0 && !!r.data_criacao)
    .forEach((r) => {
      const d = new Date(r.data_criacao);
      if (isNaN(d.getTime())) return;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!Array.isArray(r.itens)) return;
      (r.itens as any[]).forEach((item) => {
        if (isGiftItem(item)) return;
        const name = item?.name || item?.nome || "Sem nome";
        const qty = Number(item?.quantity ?? item?.quantidade ?? 1) || 0;
        const size = item?.selectedSize?.name ? String(item.selectedSize.name) : null;
        const subtotal =
          item?.subtotal != null
            ? Number(item.subtotal)
            : Number(item?.price ?? item?.preco ?? 0) * qty;
        const menuItemId = item?.menuItemId != null ? String(item.menuItemId) : null;
        const fallbackCategory =
          typeof item?.category === "string" && item.category.trim() ? item.category.trim() : "";
        const key = `${monthKey}__${menuItemId ?? name}__${size ?? ""}`;
        const existing = agg.get(key);
        if (existing) {
          existing.quantity += qty;
          existing.revenue += subtotal;
        } else {
          agg.set(key, {
            monthKey,
            name,
            size,
            quantity: qty,
            revenue: subtotal,
            category: "",
            categoryId: "",
            menuItemId,
            fallbackCategory,
          });
        }
      });
    });

  // Resolve a categoria de cada produto a partir do menu e dos cadastros
  const itemIds = Array.from(
    new Set(Array.from(agg.values()).map((r) => r.menuItemId).filter((id): id is string => !!id)),
  );
  const categoryByItemId = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: miRows } = await cachedFetch(
      `menu_items|category|${[...itemIds].sort().join(",")}`,
      async () =>
        await supabase
          .from("menu_items" as any)
          .select("id, category")
          .in("id", itemIds),
      5 * 60_000,
    );
    ((miRows ?? []) as any[]).forEach((row) => {
      categoryByItemId.set(String(row.id), String(row.category ?? ""));
    });
  }

  const catIds = Array.from(new Set(Array.from(categoryByItemId.values()).filter(Boolean)));
  const categoryNameById = new Map<string, string>();
  if (catIds.length > 0) {
    const { data: catRows } = await cachedFetch(
      `categories|name|${[...catIds].sort().join(",")}`,
      async () =>
        await supabase
          .from("categories" as any)
          .select("id, name")
          .in("id", catIds),
      5 * 60_000,
    );
    ((catRows ?? []) as any[]).forEach((row) => {
      categoryNameById.set(String(row.id), String(row.name ?? row.id));
    });
  }

  Array.from(agg.values()).forEach((row) => {
    const catId = row.menuItemId ? categoryByItemId.get(row.menuItemId) ?? "" : "";
    if (catId) {
      row.categoryId = catId;
      row.category = categoryNameById.get(catId) ?? catId;
    } else if (row.fallbackCategory) {
      row.categoryId = row.fallbackCategory;
      row.category = row.fallbackCategory;
    } else {
      row.categoryId = "";
      row.category = "Sem categoria";
    }
  });

  return Array.from(agg.values()).sort(
    (a, b) => (a.monthKey < b.monthKey ? 1 : a.monthKey > b.monthKey ? -1 : b.quantity - a.quantity),
  );
};
