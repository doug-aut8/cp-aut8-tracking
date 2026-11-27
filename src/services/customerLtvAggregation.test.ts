/// <reference types="node" />
import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { aggregateCustomerLtv, customerStatus, filterCustomerLtv, summarizeCustomerLtv, customerLtvCsv, type CustomerLtvOrder } from "./customerLtvAggregation";
const now = new Date("2026-11-13T12:00:00Z");
const order = (id: string, date: string, campaign = "refri600", value = 40): CustomerLtvOrder => ({ id, telefone_cliente: "11999991111", nome_cliente: "Cliente", user_email: null, utm_source: "instagram", utm_campaign: campaign, valor_total: value, data_criacao: `${date}T12:00:00Z`, status_atual: "delivered" });
describe("Individual customer LTV", () => {
  it("normalizes phone and sums later purchases across campaigns", () => {
    const result = aggregateCustomerLtv([order("first", "2026-09-01"), { ...order("later", "2026-11-01", "other", 60), telefone_cliente: "+55 (11) 99999-1111" }], now);
    strictEqual(result.customers.length, 1);
    strictEqual(result.customers[0].ltv, 100);
    strictEqual(result.customers[0].orders, 2);
    strictEqual(result.customers[0].avgTicket, 50);
    strictEqual(result.customers[0].campaign, "refri600");
  });
  it("uses acquisition dates and first campaign, not later order dates, while preserving lifetime totals", () => {
    const rows = aggregateCustomerLtv([order("first", "2026-09-01"), order("later", "2026-11-01", "other", 60)], now).customers;
    strictEqual(filterCustomerLtv(rows, { start: new Date("2026-11-01"), end: now }).length, 0);
    strictEqual(filterCustomerLtv(rows, { campaign: "other" }).length, 0);
    strictEqual(filterCustomerLtv(rows, { start: new Date("2026-09-01"), end: new Date("2026-09-30"), campaign: "refri600" })[0].ltv, 100);
  });
  it("excludes cancelled purchases from acquisition, totals and recency", () => {
    const rows = aggregateCustomerLtv([{ ...order("cancel", "2026-08-01"), status_atual: "cancelled" }, order("first", "2026-09-01"), { ...order("cancel2", "2026-11-12"), status_atual: "cancelado" }], now).customers;
    strictEqual(rows[0].orders, 1);
    strictEqual(rows[0].ltv, 40);
    strictEqual(rows[0].lastOrderAt, "2026-09-01T12:00:00Z");
  });
  it("does not merge unidentified buyers or invent missing acquisition UTMs", () => {
    const result = aggregateCustomerLtv([{ ...order("missing", "2026-09-01"), telefone_cliente: null }, { ...order("known", "2026-09-01"), utm_campaign: null, utm_source: null }], now);
    strictEqual(result.unidentifiedOrders, 1);
    strictEqual(result.customers.length, 1);
    strictEqual(result.customers[0].campaign, "Não informada");
    strictEqual(result.customers[0].source, "Não informada");
  });
  it("sets active through 30 days, risk from 31 to 60, inactive after 60", () => {
    deepStrictEqual([0, 30, 31, 60, 61].map(customerStatus), ["active", "active", "risk", "risk", "inactive"]);
  });
  it("calculates average LTV and repurchase percentage per unique customer", () => {
    const rows = aggregateCustomerLtv([order("a", "2026-09-01"), order("b", "2026-11-01", "other", 60), { ...order("c", "2026-11-01", "other", 200), telefone_cliente: "11999992222" }], now).customers;
    const summary = summarizeCustomerLtv(rows);
    strictEqual(summary.total, 2);
    strictEqual(summary.avgLtv, 150);
    strictEqual(summary.repeatRate, 50);
  });
  it("searches formatted phones and names and sorts customers", () => {
    const rows = aggregateCustomerLtv([order("a", "2026-09-01"), { ...order("b", "2026-11-01", "other", 60), nome_cliente: "Maria", telefone_cliente: "11999992222" }], now).customers;
    strictEqual(filterCustomerLtv(rows, { search: "maria" })[0].ltv, 60);
    strictEqual(filterCustomerLtv(rows, { search: "(11) 99999-1111" })[0].ltv, 40);
    strictEqual(filterCustomerLtv(rows, { status: "active", sort: "ltv" })[0].name, "Maria");
  });
  it("exports all filtered customers, quotes commas, and neutralizes spreadsheet formulas", () => {
    const rows = aggregateCustomerLtv([{ ...order("a", "2026-09-01"), nome_cliente: '=SUM(1,2)' }], now).customers;
    const csv = customerLtvCsv(rows);
    strictEqual(csv.startsWith("\uFEFF"), true);
    strictEqual(csv.includes('"\'=SUM(1,2)"'), true);
    strictEqual(csv.includes('"40.00"'), true);
  });
});