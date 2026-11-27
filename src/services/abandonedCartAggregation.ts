/** Cart snapshots use a total price; legacy product rows use a unit price. */
export interface AbandonedCartEvent {
  id?: string;
  event_type: string;
  product_id?: string | null;
  session_id?: string | null;
  visitor_id?: string | null;
  created_at: string;
  price?: number | string | null;
  quantity?: number | string | null;
  items?: unknown;
}

export interface AbandonedCartSummary {
  lostRevenue: number;
  abandonedCount: number;
  avgAbandonedTicket: number;
}

const positiveNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

export const abandonedEventValue = (row: AbandonedCartEvent): number =>
  row.product_id === 'cart' || Array.isArray(row.items)
    ? positiveNumber(row.price)
    : positiveNumber(row.price) * positiveNumber(row.quantity ?? 1);

/** Only recorded session/visitor identities link recovery; a checkout click is not a purchase. */
export interface AbandonedCartEntry {
  key: string;
  sessionId: string | null;
  visitorId: string | null;
  createdAt: string;
  value: number;
  items: Array<{ name: string; quantity: number; price: number }>;
}

const entryItems = (latest: AbandonedCartEvent, legacy: AbandonedCartEvent[]): AbandonedCartEntry['items'] => {
  if (Array.isArray(latest.items)) {
    return (latest.items as any[]).map(i => ({
      name: String(i?.product_name ?? i?.name ?? 'Item'),
      quantity: positiveNumber(i?.quantity ?? 1) || 1,
      price: positiveNumber(i?.price),
    }));
  }
  return legacy.map(r => ({ name: String((r as any).product_name ?? r.product_id ?? 'Item'), quantity: positiveNumber(r.quantity ?? 1) || 1, price: positiveNumber(r.price) }));
};

export const summarizeAbandonedCarts = (
  abandoned: AbandonedCartEvent[],
  purchases: AbandonedCartEvent[],
): AbandonedCartSummary => {
  const totals = listAbandonedCarts(abandoned, purchases).map(e => e.value);
  const lostRevenue = totals.reduce((sum, value) => sum + value, 0);
  return { lostRevenue, abandonedCount: totals.length, avgAbandonedTicket: totals.length ? lostRevenue / totals.length : 0 };
};

/** Same rules as the summary, one entry per unrecovered cart, newest first. */
export const listAbandonedCarts = (
  abandoned: AbandonedCartEvent[],
  purchases: AbandonedCartEvent[],
): AbandonedCartEntry[] => {
  const latestPurchaseBySession = new Map<string, number>();
  const latestPurchaseByVisitor = new Map<string, number>();
  for (const purchase of purchases) {
    if (purchase.event_type !== 'purchase') continue;
    const time = Date.parse(purchase.created_at);
    if (!Number.isFinite(time)) continue;
    if (purchase.session_id) latestPurchaseBySession.set(purchase.session_id, Math.max(time, latestPurchaseBySession.get(purchase.session_id) ?? -Infinity));
    if (purchase.visitor_id) latestPurchaseByVisitor.set(purchase.visitor_id, Math.max(time, latestPurchaseByVisitor.get(purchase.visitor_id) ?? -Infinity));
  }

  const carts = new Map<string, AbandonedCartEvent[]>();
  for (const row of abandoned) {
    if (row.event_type !== 'abandoned_cart' || !Number.isFinite(Date.parse(row.created_at))) continue;
    // Anonymous rows cannot be reliably deduplicated or linked to a conversion.
    const key = row.session_id ? `session:${row.session_id}` : row.visitor_id ? `visitor:${row.visitor_id}` : null;
    if (!key) continue;
    const rows = carts.get(key) ?? [];
    rows.push(row);
    carts.set(key, rows);
  }

  const entries: AbandonedCartEntry[] = [];
  for (const [key, rows] of carts.entries()) {
    rows.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || (a.id ?? '').localeCompare(b.id ?? ''));
    const latest = rows[rows.length - 1];
    if (!latest) continue;
    const time = Date.parse(latest.created_at);
    const recovered = rows.some(row =>
      (row.session_id && (latestPurchaseBySession.get(row.session_id) ?? -Infinity) >= time) ||
      (row.visitor_id && (latestPurchaseByVisitor.get(row.visitor_id) ?? -Infinity) >= time),
    );
    if (recovered) continue;

    let value = 0;
    let legacy: AbandonedCartEvent[] = [];
    if (latest.product_id === 'cart' || Array.isArray(latest.items)) {
      value = abandonedEventValue(latest);
    } else {
      // Legacy events were written per product: keep each product's last state,
      // never accumulate repeated snapshots or mix with older cart-level totals.
      const products = new Map<string, AbandonedCartEvent>();
      for (const row of rows) {
        if (row.product_id === 'cart' || Array.isArray(row.items)) products.clear();
        else if (row.product_id) products.set(row.product_id, row);
      }
      legacy = [...products.values()];
      value = legacy.reduce((sum, row) => sum + abandonedEventValue(row), 0);
    }
    if (value > 0) entries.push({
      key,
      sessionId: latest.session_id ?? null,
      visitorId: latest.visitor_id ?? null,
      createdAt: latest.created_at,
      value,
      items: entryItems(latest, legacy),
    });
  }
  return entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
};

/** Both queries are paginated; recovery reads are intentionally not attribution/date-end filtered. */
type PageFetcher = (kind: 'abandoned' | 'purchases', offset: number, limit: number) => Promise<AbandonedCartEvent[]>;

export const loadAbandonedCartSummary = async (fetchPage: PageFetcher): Promise<AbandonedCartSummary> => {
  const { abandoned, purchases } = await loadAbandonedCartEvents(fetchPage);
  return summarizeAbandonedCarts(abandoned, purchases);
};

export const loadAbandonedCartEvents = async (fetchPage: PageFetcher) => {
  const load = async (kind: 'abandoned' | 'purchases') => {
    const rows: AbandonedCartEvent[] = [];
    const limit = 1000;
    for (let offset = 0; ; offset += limit) {
      const page = await fetchPage(kind, offset, limit);
      rows.push(...page);
      if (page.length < limit) return rows;
    }
  };
  const [abandoned, purchases] = await Promise.all([load('abandoned'), load('purchases')]);
  return { abandoned, purchases };
};