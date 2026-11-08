export type EfficiencyEvent = {
  created_at: string;
  event_type: string;
  session_id: string | null;
  visitor_id: string | null;
};
export type EfficiencyOrder = {
  data_criacao: string | null;
  valor_total: number | null;
  status_atual: string | null;
  cupom_desconto: string | null;
};
export type EfficiencyMetricKey = "sessions" | "revenuePerVisitor" | "revenuePerSession" | "couponUtilization";
export type EfficiencyValues = Record<EfficiencyMetricKey, number | null> & {
  visitors: number;
  orders: number;
  couponOrders: number;
};
export type EfficiencyMetrics = EfficiencyValues & { daily: Array<EfficiencyValues & { date: string }> };

const dateKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function aggregateMarketingEfficiency(
  events: EfficiencyEvent[], orders: EfficiencyOrder[], dates: string[], trafficAvailable = true,
): EfficiencyMetrics {
  const summarize = (eventRows: EfficiencyEvent[], orderRows: EfficiencyOrder[]): EfficiencyValues => {
    const sessions = new Set(eventRows.map(row => row.session_id).filter(Boolean)).size;
    const visitors = new Set(eventRows.filter(row =>
      row.event_type === "visita_cardapio_nova" || row.event_type === "visita_cardapio_recorrente"
    ).map(row => row.visitor_id).filter(Boolean)).size;
    const validOrders = orderRows.filter(row => row.status_atual !== "cancelled" && Number(row.valor_total) > 0);
    const revenue = validOrders.reduce((sum, row) => sum + Number(row.valor_total), 0);
    const couponOrders = validOrders.filter(row => Boolean(row.cupom_desconto?.trim())).length;
    return {
      sessions: trafficAvailable ? sessions : null,
      visitors,
      orders: validOrders.length,
      couponOrders,
      revenuePerVisitor: trafficAvailable && visitors > 0 ? revenue / visitors : null,
      revenuePerSession: trafficAvailable && sessions > 0 ? revenue / sessions : null,
      couponUtilization: validOrders.length > 0 ? couponOrders / validOrders.length * 100 : null,
    };
  };
  const eventsByDay = new Map<string, EfficiencyEvent[]>();
  const ordersByDay = new Map<string, EfficiencyOrder[]>();
  events.forEach(row => {
    const day = dateKey(row.created_at);
    eventsByDay.set(day, [...(eventsByDay.get(day) ?? []), row]);
  });
  orders.forEach(row => {
    if (!row.data_criacao) return;
    const day = dateKey(row.data_criacao);
    ordersByDay.set(day, [...(ordersByDay.get(day) ?? []), row]);
  });
  return {
    ...summarize(events, orders),
    daily: dates.map(date => ({ date, ...summarize(eventsByDay.get(date) ?? [], ordersByDay.get(date) ?? []) })),
  };
}