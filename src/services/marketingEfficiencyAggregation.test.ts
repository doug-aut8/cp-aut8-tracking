/// <reference types="node" />
import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
import { aggregateMarketingEfficiency } from "./marketingEfficiencyAggregation";

const dates = ["2026-11-07", "2026-11-08"];
const events = [
  { created_at: "2026-11-07T15:00:00Z", event_type: "visita_cardapio_nova", session_id: "s1", visitor_id: "v1" },
  { created_at: "2026-11-07T15:01:00Z", event_type: "view_item", session_id: "s1", visitor_id: "v1" },
  { created_at: "2026-11-08T15:00:00Z", event_type: "visita_cardapio_recorrente", session_id: "s2", visitor_id: "v1" },
];
const orders = [
  { data_criacao: "2026-11-07T16:00:00Z", valor_total: 100, status_atual: "completed", cupom_desconto: "PROMO" },
  { data_criacao: "2026-11-08T16:00:00Z", valor_total: 50, status_atual: "completed", cupom_desconto: "  " },
  { data_criacao: "2026-11-08T16:00:00Z", valor_total: 500, status_atual: "cancelled", cupom_desconto: "PROMO" },
];
describe("Marketing efficiency without campaign investment", () => {
  it("counts distinct sessions, not repeated events or visitors", () => {
    strictEqual(aggregateMarketingEfficiency(events, orders, dates).sessions, 2);
  });
  it("divides revenue by unique visitors across the full period, not daily visitor sums", () => {
    strictEqual(aggregateMarketingEfficiency(events, orders, dates).revenuePerVisitor, 150);
  });
  it("divides revenue by distinct sessions", () => {
    strictEqual(aggregateMarketingEfficiency(events, orders, dates).revenuePerSession, 75);
  });
  it("coupon utilization is coupon orders / all valid orders, excluding cancelled and blank coupons", () => {
    strictEqual(aggregateMarketingEfficiency(events, orders, dates).couponUtilization, 50);
  });
  it("computes daily ratios independently", () => {
    const result = aggregateMarketingEfficiency(events, orders, dates);
    strictEqual(result.daily[0].couponUtilization, 100);
    strictEqual(result.daily[1].revenuePerSession, 50);
  });
  it("does not invent ratios with zero denominators", () => {
    const result = aggregateMarketingEfficiency([], [], dates);
    strictEqual(result.sessions, 0);
    strictEqual(result.revenuePerVisitor, null);
    strictEqual(result.revenuePerSession, null);
    strictEqual(result.couponUtilization, null);
  });
  it("does not mix neighborhood revenue with city-wide visitors", () => {
    const result = aggregateMarketingEfficiency(events, orders, dates, false);
    strictEqual(result.sessions, null);
    strictEqual(result.revenuePerVisitor, null);
    strictEqual(result.revenuePerSession, null);
    strictEqual(result.couponUtilization, 50);
  });
});