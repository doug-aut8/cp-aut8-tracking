/// <reference types="node" />
import { describe, it } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { aggregateLocationSales, aggregateLocationProducts, type LocationOrder } from "./locationSalesAggregation";
const order = (id: string, bairro: string | null, total: number, overrides: Partial<LocationOrder> = {}): LocationOrder => ({ id, bairro, cidade: "São Paulo", valor_total: total, status_atual: "completed", data_criacao: "2026-11-07T12:00:00Z", itens: [], ...overrides });
describe("Location sales ranking", () => {
  it("ranks neighborhoods by total sales descending and merges case/whitespace differences", () => {
    const rows = aggregateLocationSales([order("a", "Centro", 50), order("b", " centro ", 75), order("c", "Jardins", 200)], "bairro");
    deepStrictEqual(rows.map(row => [row.name, row.revenue, row.orders.length]), [["Jardins", 200, 1], ["Centro", 125, 2]]);
  });
  it("groups by cities independently of neighborhoods", () => {
    const rows = aggregateLocationSales([order("a", "Centro", 50), order("b", "Jardins", 75), order("c", "Centro", 200, { cidade: "Santos" })], "cidade");
    deepStrictEqual(rows.map(row => [row.name, row.revenue]), [["Santos", 200], ["São Paulo", 125]]);
  });
  it("excludes cancelled and zero-value sales", () => {
    strictEqual(aggregateLocationSales([order("a", "Centro", 100, { status_atual: "cancelled" }), order("b", "Centro", 0), order("c", "Centro", 80)], "bairro")[0]?.revenue, 80);
  });
  it("retains sales without a location without attributing them to a named neighborhood", () => {
    const rows = aggregateLocationSales([order("a", null, 10), order("b", " ", 20)], "bairro");
    strictEqual(rows[0]?.name, "Bairro não informado");
    strictEqual(rows[0]?.revenue, 30);
  });
  it("uses only the selected neighborhood's orders for product quantities and stored subtotals", () => {
    const rows = aggregateLocationSales([order("a", "Centro", 100, { itens: [{ menuItemId: "pizza", name: "Pizza", quantity: 2, price: 30, subtotal: 80 }] }), order("b", "Jardins", 200, { itens: [{ name: "Pizza", quantity: 10, price: 20 }] })], "bairro");
    const centro = rows.find(row => row.name === "Centro");
    deepStrictEqual(aggregateLocationProducts(centro?.orders ?? []).map(row => [row.name, row.quantity, row.revenue]), [["Pizza", 2, 80]]);
  });
  it("keeps sizes separate, excludes gifts and respects a zero subtotal", () => {
    const products = aggregateLocationProducts([order("a", "Centro", 100, { itens: [{ name: "Pizza", menuItemId: "p", selectedSize: { name: "Grande" }, quantity: 2, price: 20 }, { name: "Pizza", menuItemId: "p", selectedSize: { name: "Média" }, quantity: 1, subtotal: 0, price: 30 }, { name: "Brinde", isGift: true, quantity: 5, price: 30 }] })]);
    deepStrictEqual(products.map(row => [row.name, row.quantity, row.revenue]), [["Pizza (Grande)", 2, 40], ["Pizza (Média)", 1, 0]]);
  });
});