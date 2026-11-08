/// <reference types="node" />
import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { aggregateBuyerProfile, aggregateCampaignBuyers, firstOrdersByPhone, classifyBuyer, type BuyerOrder, type BuyerEvent } from "./buyerClassification";
const order = (id: string, phone: string | null, day: number, campaign = "promo", status = "completed"): BuyerOrder => ({ id, telefone_cliente: phone, data_criacao: `2026-11-${String(day).padStart(2, "0")}T12:00:00Z`, status_atual: status, valor_total: 100, utm_campaign: campaign });
const event = (id: string, session: string, day: number, orderId?: string): BuyerEvent => ({ id, session_id: session, visitor_id: "visitor", created_at: `2026-11-${String(day).padStart(2, "0")}T12:01:00Z`, items: orderId ? [{ order_id: orderId }] : undefined });
describe("Buyer classification rules", () => {
  it("uses the historical first purchase even outside the campaign and date filters", () => {
    const old = order("old", "+55 (11) 99999-1111", 1, "other");
    const current = order("current", "11999991111", 3);
    strictEqual(classifyBuyer(current, firstOrdersByPhone([old, current])), "recorrentes");
  });
  it("only the first order is new for repeat purchases inside a period", () => {
    const orders = [order("first", "11999991111", 2), order("second", "11999991111", 3)];
    const rows = aggregateCampaignBuyers(orders, orders);
    strictEqual(rows[0]?.newCustomerPercent, 50);
    strictEqual(rows[0]?.predominantProfile, "Retenção / LTV");
  });
  it("campaign LTV sums all lifetime orders of its new customers, including later organic ones", () => {
    const first = order("first", "11999991111", 2);
    const later = order("later", "11999991111", 20, "");
    const rows = aggregateCampaignBuyers([first], [first, later]);
    strictEqual(rows[0]?.ltvRevenue, 200);
    strictEqual(rows[0]?.avgLtv, 200);
  });
  it("assigns Acquisition only above 50 percent, using the unrounded value", () => {
    const orders = [order("a", "11999991111", 2), order("b", "11999992222", 2), order("c", "11999991111", 3)];
    const rows = aggregateCampaignBuyers(orders, orders);
    strictEqual(rows[0]?.newCustomerPercent, 2 / 3 * 100);
    strictEqual(rows[0]?.predominantProfile, "Aquisição / CAC");
  });
  it("excludes cancelled orders from sales and historical first purchases", () => {
    const cancelled = order("cancel", "11999991111", 1, "promo", "cancelled");
    const first = order("first", "11999991111", 2);
    const result = aggregateBuyerProfile([cancelled, first], [cancelled, first], [], []);
    deepStrictEqual(result.customer.novos, { orders: 1, revenue: 100 });
  });
  it("restores historical purchase journeys without inventing a buyer classification", () => {
    const orders = [order("a", "11999991111", 2)];
    const result = aggregateBuyerProfile(orders, orders, [{ ...event("legacy", "s", 2), price: 100 }], [event("visit", "s", 1)]);
    strictEqual(result.customer.novos.orders, 1);
    strictEqual(result.journey.primeiraVisita.orders, 1);
    strictEqual(result.journey.primeiraVisita.revenue, 100);
    strictEqual(result.journey.primeiraVisita.novos.orders, 0);
    strictEqual(result.journey.primeiraVisita.recorrentes.orders, 0);
    strictEqual(result.unlinkedOrders, 1);
  });
  it("crosses both journey branches by exact order IDs and deduplicates purchase events", () => {
    const orders = [order("a", "11999991111", 2), order("b", "11999991111", 3), order("c", "11999992222", 3)];
    const purchases = [event("p1", "first", 2, "a"), event("duplicate", "first", 2, "a"), event("p2", "second", 3, "b"), event("p3", "second", 3, "c")];
    const visits = [event("v1", "first", 1), event("v2", "second", 2)];
    const result = aggregateBuyerProfile(orders, orders, purchases, visits);
    strictEqual(result.journey.primeiraVisita.novos.orders, 1);
    strictEqual(result.journey.retorno.novos.orders, 1);
    strictEqual(result.journey.retorno.recorrentes.orders, 1);
    strictEqual(result.journey.retorno.revenue, 200);
  });
  it("counts returning legacy sessions once and ignores visits after the purchase", () => {
    const purchases = [{ ...event("p1", "second", 3), price: 80 }, { ...event("duplicate", "second", 3), price: 80 }];
    const visits = [event("v1", "first", 1), event("v2", "second", 2), event("future", "third", 4)];
    const result = aggregateBuyerProfile([], [], purchases, visits);
    deepStrictEqual(result.journey.retorno.naoIdentificados, { orders: 1, revenue: 80 });
    strictEqual(result.journey.retorno.orders, 1);
    strictEqual(result.journey.primeiraVisita.orders, 0);
  });
  it("does not double count legacy and linked purchases in the same session", () => {
    const orders = [order("a", "11999991111", 2)];
    const result = aggregateBuyerProfile(orders, orders, [{ ...event("legacy", "s", 2), price: 100 }, event("linked", "s", 2, "a")], [event("v", "s", 1)]);
    strictEqual(result.journey.primeiraVisita.orders, 1);
    strictEqual(result.journey.primeiraVisita.revenue, 100);
    strictEqual(result.journey.primeiraVisita.naoIdentificados.orders, 0);
  });
  it("excludes linked cancelled and out-of-filter orders from journey totals", () => {
    const cancelled = order("cancel", "11999991111", 2, "promo", "cancelled");
    const outside = order("outside", "11999992222", 2);
    const result = aggregateBuyerProfile([cancelled], [cancelled, outside], [event("p1", "s", 2, "cancel"), event("p2", "s", 2, "outside")], [event("v", "s", 1)]);
    strictEqual(result.journey.primeiraVisita.orders, 0);
  });
  it("keeps linked purchases without phones in the journey with unidentified profiles", () => {
    const orders = [order("a", null, 2)];
    const result = aggregateBuyerProfile(orders, orders, [event("p", "s", 2, "a")], [event("v", "s", 1)]);
    deepStrictEqual(result.journey.primeiraVisita.naoIdentificados, { orders: 1, revenue: 100 });
    strictEqual(result.unclassifiedOrders, 1);
    strictEqual(result.unlinkedOrders, 0);
  });
  it("does not infer a visit link from a purchase alone", () => {
    const result = aggregateBuyerProfile([], [], [{ ...event("p", "s", 2), price: 100 }], [event("later", "s", 3)]);
    strictEqual(result.journey.primeiraVisita.orders, 0);
  });
  it("never labels missing phones as new customers", () => {
    const orders = [order("a", null, 2)];
    strictEqual(aggregateBuyerProfile(orders, orders, [], []).unclassifiedOrders, 1);
    strictEqual(aggregateCampaignBuyers(orders, orders)[0]?.newCustomerPercent, null);
  });
  it("classifies a returning customer buying directly on their first tracked visit", () => {
    const old = order("old", "11999991111", 1);
    const current = order("current", "11999991111", 3);
    const result = aggregateBuyerProfile([current], [old, current], [event("p", "direct", 3, "current")], [event("v", "direct", 2)]);
    strictEqual(result.journey.primeiraVisita.recorrentes.orders, 1);
  });
});