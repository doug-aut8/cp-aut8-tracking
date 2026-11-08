import { supabase } from "@/integrations/supabase/client";
import { aggregateVisitHeatmap, type VisitHeatmapEvent } from "./marketingHeatmapAggregation";

export async function fetchMenuVisitsHeatmap(start: string, end: string) {
  const events: VisitHeatmapEvent[] = [];
  const startISO = new Date(`${start}T00:00:00`).toISOString();
  const endISO = new Date(`${end}T23:59:59.999`).toISOString();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("product_events")
      .select("id, created_at, session_id")
      .in("event_type", ["visita_cardapio_nova", "visita_cardapio_recorrente"])
      .gte("created_at", startISO).lte("created_at", endISO)
      .order("created_at").order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    events.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return aggregateVisitHeatmap(events);
}