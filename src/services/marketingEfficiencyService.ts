import { supabase } from "@/integrations/supabase/client";
import { cachedFetch } from "./queryCache";
import { fetchLocationSalesOrders, type LocationSalesFilters } from "./locationSalesService";
import { aggregateMarketingEfficiency, type EfficiencyEvent } from "./marketingEfficiencyAggregation";

export function fetchMarketingEfficiency(filters: LocationSalesFilters) {
  return cachedFetch(`marketing|efficiency|${JSON.stringify(filters)}`, async () => {
    const startIso = new Date(`${filters.startDate}T00:00:00-03:00`).toISOString();
    const endIso = new Date(`${filters.endDate}T23:59:59.999-03:00`).toISOString();
    // Visit events have city, but not neighborhood. Never divide neighborhood
    // revenue by traffic from a larger, unrelated population.
    const trafficAvailable = !(filters.location?.field === "bairro" && filters.location.value);
    const eventsPromise = async () => {
      const events: EfficiencyEvent[] = [];
      if (!trafficAvailable) return events;
      for (let offset = 0; ; offset += 1000) {
        let query = supabase.from("product_events")
          .select("created_at, event_type, session_id, visitor_id")
          .gte("created_at", startIso).lte("created_at", endIso)
          .order("created_at").order("id");
        if (filters.source) query = query.eq("utm_source", filters.source);
        if (filters.campaign) query = query.eq("utm_campaign", filters.campaign);
        if (filters.location?.field === "cidade" && filters.location.value) query = query.eq("cidade", filters.location.value);
        const { data, error } = await query.range(offset, offset + 999);
        if (error) throw new Error(error.message);
        events.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) return events;
      }
    };
    const [events, orders] = await Promise.all([eventsPromise(), fetchLocationSalesOrders(filters)]);
    const dates: string[] = [];
    const date = new Date(`${filters.startDate}T12:00:00Z`);
    while (date.toISOString().slice(0, 10) <= filters.endDate) {
      dates.push(date.toISOString().slice(0, 10));
      date.setUTCDate(date.getUTCDate() + 1);
    }
    return aggregateMarketingEfficiency(events, orders.map(row => ({ ...row, cupom_desconto: row.cupom_desconto ?? null })), dates, trafficAvailable);
  });
}