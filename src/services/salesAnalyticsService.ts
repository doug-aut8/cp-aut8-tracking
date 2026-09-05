import { supabase } from "@/integrations/supabase/client";

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

  const query = supabase
    .from("pedidos_sabor_delivery" as any)
    .select(select)
    .gte("data_criacao", startIso)
    .lte("data_criacao", endIso)
    .neq("status_atual", "cancelled");

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]) as T[];
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

  const { data, error } = await supabase
    .from("pedidos_sabor_delivery" as any)
    .select("itens, valor_total, status_atual, data_criacao, utm_campaign")
    .gte("data_criacao", startIso)
    .lte("data_criacao", endIso)
    .neq("status_atual", "cancelled")
    .eq("utm_campaign", campaign);

  if (error) throw new Error(error.message);

  const map = new Map<string, { quantitySold: number; revenue: number }>();

  ((data ?? []) as any[]).forEach((order) => {
    const items = order.itens;
    if (!Array.isArray(items)) return;

    items.forEach((item: any) => {
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

  const { data, error } = await supabase
    .from("pedidos_sabor_delivery" as any)
    .select("itens, valor_total, status_atual, data_criacao")
    .gte("data_criacao", startIso)
    .lte("data_criacao", endIso)
    .neq("status_atual", "cancelled");

  if (error) throw new Error(error.message);

  const map = new Map<string, { quantitySold: number; revenue: number }>();

  ((data ?? []) as any[]).forEach((order) => {
    const items = order.itens;
    if (!Array.isArray(items)) return;

    items.forEach((item: any) => {
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
