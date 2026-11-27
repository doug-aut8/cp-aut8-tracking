import { supabase } from "@/integrations/supabase/client";
import { cachedFetch } from "@/services/queryCache";
import type { LocationFilter } from "@/services/salesAnalyticsService";
import type { LocationOrder } from "./locationSalesAggregation";

export type LocationSalesFilters = {
  startDate: string;
  endDate: string;
  source: string | null;
  campaign: string | null;
  location: LocationFilter | null;
};

export function fetchLocationSalesOrders(filters: LocationSalesFilters): Promise<LocationOrder[]> {
  const startIso = new Date(`${filters.startDate}T00:00:00`).toISOString();
  const endIso = new Date(`${filters.endDate}T23:59:59.999`).toISOString();
  return cachedFetch(`orders|location-sales|${JSON.stringify([startIso, endIso, filters.source, filters.campaign, filters.location?.field, filters.location?.value])}`, async () => {
    const orders: LocationOrder[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = supabase.from("pedidos_sabor_delivery")
        .select("id, data_criacao, valor_total, status_atual, cidade, bairro, nome_cliente, codigo_pedido, codigo_curto, itens, cupom_desconto")
        .gte("data_criacao", startIso).lte("data_criacao", endIso)
        .neq("status_atual", "cancelled").gt("valor_total", 0)
        .order("data_criacao", { ascending: false }).order("id", { ascending: false });
      if (filters.source) query = query.eq("utm_source", filters.source);
      if (filters.campaign) query = query.eq("utm_campaign", filters.campaign);
      if (filters.location?.value) query = query.eq(filters.location.field, filters.location.value);
      const { data, error } = await query.range(offset, offset + 999);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as LocationOrder[];
      orders.push(...rows);
      if (rows.length < 1000) return orders;
    }
  });
}