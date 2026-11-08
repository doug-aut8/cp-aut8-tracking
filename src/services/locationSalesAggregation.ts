import { getOrderItemDisplayName } from "../utils/orderItemDisplay";

export type LocationSalesField = "bairro" | "cidade";
export type LocationOrder = {
  id: string;
  data_criacao: string | null;
  valor_total: number | null;
  status_atual: string | null;
  cidade: string | null;
  bairro: string | null;
  nome_cliente?: string | null;
  codigo_pedido?: string | null;
  codigo_curto?: string | null;
  cupom_desconto?: string | null;
  itens: unknown;
};
export type LocationSalesRow = {
  id: string;
  name: string;
  revenue: number;
  orders: LocationOrder[];
};
export type LocationProductRow = { id: string; name: string; quantity: number; revenue: number };
const number = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalize = (value: string | null) => (value ?? "").trim().replace(/\s+/g, " ");

export function aggregateLocationSales(orders: LocationOrder[], field: LocationSalesField): LocationSalesRow[] {
  const groups = new Map<string, LocationSalesRow>();
  for (const order of orders) {
    if (order.status_atual === "cancelled" || number(order.valor_total) <= 0) continue;
    const location = normalize(order[field]);
    const id = location.toLocaleLowerCase("pt-BR");
    const current = groups.get(id) ?? { id, name: location || (field === "bairro" ? "Bairro não informado" : "Cidade não informada"), revenue: 0, orders: [] };
    current.revenue += number(order.valor_total);
    current.orders.push(order);
    groups.set(id, current);
  }
  return [...groups.values()].sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name, "pt-BR"));
}

export function aggregateLocationProducts(orders: LocationOrder[]): LocationProductRow[] {
  const products = new Map<string, LocationProductRow>();
  for (const order of orders) {
    if (order.status_atual === "cancelled" || number(order.valor_total) <= 0 || !Array.isArray(order.itens)) continue;
    for (const item of order.itens) {
      if (!item || typeof item !== "object" || item.isGift || String(item.menuItemId ?? "").startsWith("gift-") || item.category === "brinde") continue;
      const name = getOrderItemDisplayName({ ...item, name: item.name || item.nome || "Sem nome" });
      // The display name includes size and half-pizza flavors; do not merge distinct combinations.
      const id = JSON.stringify([item.menuItemId ?? item.id ?? null, name]);
      const quantity = number(item.quantity ?? item.quantidade ?? 1);
      const revenue = item.subtotal != null ? number(item.subtotal) : number(item.price ?? item.preco) * quantity;
      const current = products.get(id) ?? { id, name, quantity: 0, revenue: 0 };
      current.quantity += quantity;
      current.revenue += revenue;
      products.set(id, current);
    }
  }
  return [...products.values()].sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity || a.name.localeCompare(b.name, "pt-BR"));
}