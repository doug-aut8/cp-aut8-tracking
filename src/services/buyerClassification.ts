export interface BuyerSegment { revenue: number; orders: number }
export interface JourneySegment extends BuyerSegment { novos: BuyerSegment; recorrentes: BuyerSegment; naoIdentificados: BuyerSegment }
export interface BuyerProfile {
  customer: { novos: BuyerSegment; recorrentes: BuyerSegment };
  journey: { primeiraVisita: JourneySegment; retorno: JourneySegment };
  unclassifiedOrders: number;
  unlinkedOrders: number;
}
export interface BuyerOrder {
  id: string;
  telefone_cliente: string | null;
  data_criacao: string | null;
  status_atual: string | null;
  valor_total?: number | null;
  utm_campaign?: string | null;
}
export interface BuyerEvent {
  id: string;
  session_id: string | null;
  visitor_id: string | null;
  created_at: string;
  items?: unknown;
  price?: number | null;
}
export const normalizeBuyerPhone = (raw: string | null) => (raw ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
const validOrder = (order: BuyerOrder) => !["cancelled", "cancelado"].includes(order.status_atual ?? "") && !!order.data_criacao;
export function firstOrdersByPhone(history: BuyerOrder[]) {
  const first = new Map<string, string>();
  [...history].filter(validOrder).sort((a, b) => String(a.data_criacao).localeCompare(String(b.data_criacao)) || a.id.localeCompare(b.id)).forEach(order => {
    const phone = normalizeBuyerPhone(order.telefone_cliente);
    if (phone && !first.has(phone)) first.set(phone, order.id);
  });
  return first;
}
export function classifyBuyer(order: BuyerOrder, first: Map<string, string>): "novos" | "recorrentes" | null {
  const phone = normalizeBuyerPhone(order.telefone_cliente);
  const firstId = first.get(phone);
  return !phone || !firstId ? null : firstId === order.id ? "novos" : "recorrentes";
}
export function aggregateBuyerProfile(orders: BuyerOrder[], history: BuyerOrder[], purchases: BuyerEvent[], visits: BuyerEvent[]): BuyerProfile {
  const empty = (): BuyerSegment => ({ orders: 0, revenue: 0 });
  const journey = (): JourneySegment => ({ ...empty(), novos: empty(), recorrentes: empty(), naoIdentificados: empty() });
  const result: BuyerProfile = { customer: { novos: empty(), recorrentes: empty() }, journey: { primeiraVisita: journey(), retorno: journey() }, unclassifiedOrders: 0, unlinkedOrders: 0 };
  const first = firstOrdersByPhone(history);
  const orderIdFor = (event: BuyerEvent): string | undefined => {
    if (!Array.isArray(event.items)) return undefined;
    const ids = new Set(event.items.map((item: { order_id?: unknown }) => item?.order_id).filter((id): id is string => typeof id === "string" && !!id));
    return ids.size === 1 ? [...ids][0] : undefined;
  };
  const visitsByVisitor = new Map<string, BuyerEvent[]>();
  visits.forEach(visit => {
    if (!visit.visitor_id || !visit.session_id) return;
    const list = visitsByVisitor.get(visit.visitor_id) ?? [];
    list.push(visit);
    visitsByVisitor.set(visit.visitor_id, list);
  });
  const selectedOrders = new Map(orders.filter(validOrder).map(order => [order.id, order]));
  const linkedOrders = new Set<string>();
  const counted = new Set<string>();
  // Linked purchases replace legacy duplicates in the same session; never guess an order link.
  const linkedSessions = new Set(purchases.filter(event => orderIdFor(event) && event.visitor_id && event.session_id)
    .map(event => JSON.stringify([event.visitor_id, event.session_id])));
  [...purchases].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach(purchase => {
    if (!purchase.visitor_id || !purchase.session_id) return;
    const orderId = orderIdFor(purchase);
    const order = orderId ? selectedOrders.get(orderId) : undefined;
    if (orderId && !order) return; // Includes cancelled and out-of-filter orders.
    const sessionKey = JSON.stringify([purchase.visitor_id, purchase.session_id]);
    if (!orderId && linkedSessions.has(sessionKey)) return;
    // Ambiguous explicit IDs must not be treated as legacy purchases.
    if (!orderId && Array.isArray(purchase.items) && purchase.items.some(item => item?.order_id)) return;
    const key = orderId ? `order:${orderId}` : `session:${sessionKey}`;
    if (counted.has(key)) return;
    const sessions = visitsByVisitor.get(purchase.visitor_id) ?? [];
    if (!sessions.some(visit => visit.session_id === purchase.session_id && visit.created_at <= purchase.created_at)) return;
    counted.add(key);
    if (orderId) linkedOrders.add(orderId);
    const kind = order ? classifyBuyer(order, first) : null;
    const itemTotal = Array.isArray(purchase.items) ? purchase.items.reduce((sum, item) => sum + Number(item?.price ?? 0) * Number(item?.quantity ?? 1), 0) : 0;
    const revenue = Number(order ? order.valor_total ?? 0 : purchase.price ?? itemTotal);
    const returned = sessions.some(visit => visit.session_id !== purchase.session_id && visit.created_at < purchase.created_at);
    const segment = returned ? result.journey.retorno : result.journey.primeiraVisita;
    segment.orders++;
    segment.revenue += revenue;
    segment[kind ?? "naoIdentificados"].orders++;
    segment[kind ?? "naoIdentificados"].revenue += revenue;
  });
  selectedOrders.forEach(order => {
    if (!linkedOrders.has(order.id)) result.unlinkedOrders++;
    const kind = classifyBuyer(order, first);
    if (!kind) { result.unclassifiedOrders++; return; }
    const revenue = Number(order.valor_total ?? 0);
    result.customer[kind].orders++;
    result.customer[kind].revenue += revenue;
  });
  return result;
}
export function aggregateCampaignBuyers(orders: BuyerOrder[], history: BuyerOrder[]) {
  const first = firstOrdersByPhone(history);
  // Lifetime revenue per customer (all valid orders in history, any origin).
  const lifetimeByPhone = new Map<string, number>();
  history.filter(validOrder).forEach(order => {
    const phone = normalizeBuyerPhone(order.telefone_cliente);
    if (phone) lifetimeByPhone.set(phone, (lifetimeByPhone.get(phone) ?? 0) + Number(order.valor_total ?? 0));
  });
  const campaigns = new Map<string, { campaign: string; orders: number; revenue: number; newCustomers: number; classifiedOrders: number; ltvRevenue: number }>();
  orders.filter(validOrder).forEach(order => {
    const campaign = order.utm_campaign?.trim();
    if (!campaign) return;
    const row = campaigns.get(campaign) ?? { campaign, orders: 0, revenue: 0, newCustomers: 0, classifiedOrders: 0, ltvRevenue: 0 };
    const kind = classifyBuyer(order, first);
    row.orders++;
    row.revenue += Number(order.valor_total ?? 0);
    if (kind) row.classifiedOrders++;
    if (kind === "novos") {
      row.newCustomers++;
      row.ltvRevenue += lifetimeByPhone.get(normalizeBuyerPhone(order.telefone_cliente)) ?? 0;
    }
    campaigns.set(campaign, row);
  });
  return [...campaigns.values()].map(row => {
    const newCustomerPercent = row.classifiedOrders ? row.newCustomers / row.classifiedOrders * 100 : null;
    const avgLtv = row.newCustomers ? row.ltvRevenue / row.newCustomers : null;
    return { ...row, avgLtv, newCustomerPercent, predominantProfile: newCustomerPercent === null ? null : newCustomerPercent > 50 ? "Aquisição / CAC" : "Retenção / LTV" };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}