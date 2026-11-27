import { differenceInCalendarDays } from "date-fns";
import { normalizeBuyerPhone, type BuyerOrder } from "./buyerClassification";

export interface CustomerLtvOrder extends BuyerOrder {
  nome_cliente: string | null;
  user_email: string | null;
  utm_source: string | null;
}
export type CustomerStatus = "active" | "risk" | "inactive";
export interface CustomerLtvRow {
  phone: string;
  name: string;
  email: string;
  source: string;
  campaign: string;
  acquiredAt: string;
  lastOrderAt: string;
  orders: number;
  ltv: number;
  avgTicket: number;
  daysSinceLastOrder: number;
  status: CustomerStatus;
}
export const customerStatus = (days: number): CustomerStatus => days <= 30 ? "active" : days <= 60 ? "risk" : "inactive";

export function aggregateCustomerLtv(history: CustomerLtvOrder[], now = new Date()) {
  const customers = new Map<string, CustomerLtvRow>();
  let unidentifiedOrders = 0;
  const rows = history.filter(order => {
    const date = new Date(order.data_criacao ?? "");
    return Number.isFinite(date.getTime()) && date <= now && !["cancelled", "cancelado"].includes((order.status_atual ?? "").toLowerCase());
  }).sort((a, b) => String(a.data_criacao).localeCompare(String(b.data_criacao)) || a.id.localeCompare(b.id));
  for (const order of rows) {
    const phone = normalizeBuyerPhone(order.telefone_cliente);
    if (!phone) { unidentifiedOrders++; continue; }
    if (!order.data_criacao) continue;
    const value = Number(order.valor_total ?? 0);
    const revenue = Number.isFinite(value) ? value : 0;
    const row = customers.get(phone) ?? {
      phone, name: "Sem nome", email: "", source: order.utm_source?.trim() || "Não informada",
      campaign: order.utm_campaign?.trim() || "Não informada", acquiredAt: order.data_criacao,
      lastOrderAt: order.data_criacao, orders: 0, ltv: 0, avgTicket: 0, daysSinceLastOrder: 0, status: "active" as CustomerStatus,
    };
    row.orders++;
    row.ltv += revenue;
    row.lastOrderAt = order.data_criacao;
    if (order.nome_cliente?.trim()) row.name = order.nome_cliente.trim();
    if (order.user_email?.trim()) row.email = order.user_email.trim();
    customers.set(phone, row);
  }
  return { customers: [...customers.values()].map(row => {
    const daysSinceLastOrder = Math.max(0, differenceInCalendarDays(now, new Date(row.lastOrderAt)));
    return { ...row, avgTicket: row.ltv / row.orders, daysSinceLastOrder, status: customerStatus(daysSinceLastOrder) };
  }), unidentifiedOrders };
}

export interface CustomerLtvFilters {
  start?: Date;
  end?: Date;
  source?: string;
  campaign?: string;
  status?: CustomerStatus | "all";
  search?: string;
  sort?: "ltv" | "orders" | "recent" | "oldest";
}
export function filterCustomerLtv(rows: CustomerLtvRow[], filters: CustomerLtvFilters) {
  const search = filters.search?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const phoneSearch = normalizeBuyerPhone(search);
  return rows.filter(row => {
    const acquiredAt = new Date(row.acquiredAt);
    return (!filters.start || acquiredAt >= filters.start) && (!filters.end || acquiredAt <= filters.end)
      && (!filters.source || row.source === filters.source) && (!filters.campaign || row.campaign === filters.campaign)
      && (!filters.status || filters.status === "all" || row.status === filters.status)
      && (!search || row.name.toLocaleLowerCase("pt-BR").includes(search) || (!!phoneSearch && row.phone.includes(phoneSearch)));
  }).sort((a, b) => {
    const delta = filters.sort === "orders" ? b.orders - a.orders : filters.sort === "recent" ? b.lastOrderAt.localeCompare(a.lastOrderAt)
      : filters.sort === "oldest" ? a.lastOrderAt.localeCompare(b.lastOrderAt) : b.ltv - a.ltv;
    return delta || a.phone.localeCompare(b.phone);
  });
}
export function summarizeCustomerLtv(rows: CustomerLtvRow[]) {
  const total = rows.length;
  const ltv = rows.reduce((sum, row) => sum + row.ltv, 0);
  const repeat = rows.filter(row => row.orders >= 2).length;
  return { total, avgLtv: total ? ltv / total : 0, repeatRate: total ? repeat / total * 100 : 0,
    active: rows.filter(row => row.status === "active").length,
    risk: rows.filter(row => row.status === "risk").length,
    inactive: rows.filter(row => row.status === "inactive").length };
}
export const customerStatusLabels: Record<CustomerStatus, string> = { active: "Ativo", risk: "Em risco", inactive: "Inativo" };
export function customerLtvCsv(rows: CustomerLtvRow[]) {
  const cell = (value: string | number) => {
    const text = typeof value === "string" && /^[=+@\-\t\r]/.test(value) ? `'${value}` : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const header = ["Nome", "Telefone", "Email", "Origem de aquisição", "Campanha de aquisição", "Primeira compra", "Pedidos", "LTV", "Ticket médio", "Última compra", "Dias sem comprar", "Status"];
  return "\uFEFF" + [header, ...rows.map(row => [row.name, row.phone, row.email, row.source, row.campaign,
    row.acquiredAt, row.orders, row.ltv.toFixed(2), row.avgTicket.toFixed(2), row.lastOrderAt, row.daysSinceLastOrder, customerStatusLabels[row.status]])]
    .map(row => row.map(cell).join(",")).join("\r\n");
}