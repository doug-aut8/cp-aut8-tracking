import { supabase } from '@/integrations/supabase/client';
import { getSessionId, getVisitorId } from '@/utils/sessionId';
import { getUtmParams } from '@/utils/utmCapture';
import { format, subDays, differenceInCalendarDays } from 'date-fns';
import { cachedFetch } from './queryCache';

/**
 * Marco temporal: o painel de inteligência ignora eventos anteriores a esta data,
 * pois eles foram registrados antes da introdução de visitor_id/session_id.
 */
export const FUNNEL_CUTOFF_ISO = '2026-04-27T00:00:00.000Z';

/**
 * Busca TODAS as linhas de uma query, contornando o limite padrão
 * de 1000 linhas do PostgREST/Supabase.
 */
const PAGE_SIZE = 1000;
const fetchAllRows = async (buildQuery: () => any): Promise<{ data: any[] | null; error: any }> => {
  const all: any[] = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const rows = (data as any[]) || [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    if (offset > 200000) break; // salvaguarda
  }
  return { data: all, error: null };
};

export type ProductEventType = 
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'purchase'
  | 'begin_checkout'
  | 'update_cart_quantity'
  | 'update_checkout_quantity'
  | 'visita_cardapio_nova'
  | 'visita_cardapio_recorrente'
  | 'abandoned_cart'
  | 'checkout_finalize';

interface ProductEventPayload {
  product_id: string;
  product_name: string;
  event_type: ProductEventType;
  price?: number;
  category?: string;
  quantity?: number;
}

/** Item individual dentro do array JSONB `items` de um evento de carrinho. */
export interface CartEventItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  category?: string | null;
}

/** Eventos de nível de carrinho/sessão — 1 linha por evento. */
export type CartEventType = 'begin_checkout' | 'purchase' | 'abandoned_cart' | 'checkout_finalize';

export const CART_EVENT_PRODUCT_ID = 'cart';


/**
 * Persists a product event to Supabase (fire-and-forget).
 */
export const trackProductEvent = (payload: ProductEventPayload) => {
  const sessionId = getSessionId();
  const visitorId = getVisitorId();
  const utms = getUtmParams();

  supabase
    .from('product_events' as any)
    .insert({
      product_id: payload.product_id,
      product_name: payload.product_name,
      event_type: payload.event_type,
      price: payload.price ?? 0,
      category: payload.category ?? null,
      quantity: payload.quantity ?? 1,
      session_id: sessionId,
      visitor_id: visitorId,
      utm_source: utms.utm_source ?? null,
      utm_medium: utms.utm_medium ?? null,
      utm_campaign: utms.utm_campaign ?? null,
      utm_content: utms.utm_content ?? null,
      utm_term: utms.utm_term ?? null,
    })
    .then(({ error }) => {
      if (error) console.error('Error tracking product event:', error);
    });
};

/**
 * Persiste UM único evento de nível de carrinho/sessão (begin_checkout,
 * purchase, abandoned_cart, checkout_finalize).
 *
 * - `price`: valor total do carrinho (soma de price * quantity de todos os itens)
 * - `quantity`: quantidade total somada de itens
 * - `items`: array JSONB com os detalhes de cada produto
 */
export const trackCartEvent = (
  eventType: CartEventType,
  items: CartEventItem[],
  totalValue?: number
) => {
  const sessionId = getSessionId();
  const visitorId = getVisitorId();
  const utms = getUtmParams();

  const itemsPayload = items.map((i) => ({
    product_id: i.product_id,
    product_name: i.product_name,
    price: Number(i.price ?? 0),
    quantity: Number(i.quantity ?? 1),
    ...(i.category ? { category: i.category } : {}),
  }));

  const computedTotal = itemsPayload.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalQuantity = itemsPayload.reduce((sum, i) => sum + i.quantity, 0);

  supabase
    .from('product_events' as any)
    .insert({
      product_id: CART_EVENT_PRODUCT_ID,
      product_name: CART_EVENT_PRODUCT_ID,
      event_type: eventType,
      price: totalValue ?? computedTotal,
      category: null,
      quantity: totalQuantity,
      items: itemsPayload,
      session_id: sessionId,
      visitor_id: visitorId,
      utm_source: utms.utm_source ?? null,
      utm_medium: utms.utm_medium ?? null,
      utm_campaign: utms.utm_campaign ?? null,
      utm_content: utms.utm_content ?? null,
      utm_term: utms.utm_term ?? null,
    })
    .then(({ error }) => {
      if (error) console.error('Error tracking cart event:', error);
    });
};

/**
 * Valor total de uma linha de evento.
 * - Eventos novos de carrinho (com array `items`): `price` já é o total.
 * - Linhas legadas (1 por item): price * quantity.
 */
export const eventTotalValue = (row: any): number => {
  if (Array.isArray(row?.items)) return Number(row.price ?? 0);
  return Number(row?.price ?? 0) * Number(row?.quantity ?? 1);
};




export interface ProductMetric {
  product_id: string;
  product_name: string;
  views: number;
  sales: number;
}

/**
 * Fetches aggregated product metrics (views + sales) for admin dashboard.
 */
export const getProductMetrics = async (): Promise<ProductMetric[]> => {
  const { data, error } = await supabase
    .from('product_events' as any)
    .select('product_id, product_name, event_type, quantity, category, items')
    ;

  if (error || !data) {
    console.error('Error fetching product metrics:', error);
    return [];
  }

  const metricsMap = new Map<string, ProductMetric>();

  const ensure = (id: string, name: string) => {
    if (!metricsMap.has(id)) {
      metricsMap.set(id, { product_id: id, product_name: name, views: 0, sales: 0 });
    }
    return metricsMap.get(id)!;
  };

  (data as any[]).forEach((row: any) => {
    // Brindes (cupom "compre e ganhe") nunca entram nas métricas de vendas
    if (row.category === 'brinde') return;

    // Evento de carrinho: expande os produtos do array JSONB
    if (row.event_type === 'purchase' && Array.isArray(row.items)) {
      row.items.forEach((it: any) => {
        if (it?.category === 'brinde') return;
        const itemId = String(it?.product_id ?? '');
        if (!itemId) return;
        ensure(itemId, it?.product_name ?? itemId).sales += Number(it?.quantity ?? 1);
      });
      return;
    }

    const m = ensure(row.product_id, row.product_name);
    if (row.event_type === 'view_item') m.views++;
    if (row.event_type === 'purchase') m.sales += (row.quantity ?? 1);
  });


  return Array.from(metricsMap.values());
};

// ---- Funnel data for admin-intelligence ----

export interface FunnelData {
  product_name: string;
  product_id: string;
  views: number;
  addToCart: number;
  purchases: number;
}

export interface FunnelGlobals {
  menuVisits: number;
  beginCheckout: number;
  /** Sessões únicas que tiveram pelo menos 1 view_item (qualquer produto). */
  viewItemSessions: number;
  /** Sessões únicas que tiveram pelo menos 1 add_to_cart (qualquer produto). */
  addToCartSessions: number;
  /** Sessões únicas que tiveram pelo menos 1 purchase (qualquer produto). */
  purchaseSessions: number;
}

export interface FunnelResult {
  perProduct: FunnelData[];
  globals: FunnelGlobals;
}

/**
 * Funil baseado em SESSÕES ÚNICAS (não em contagem bruta de eventos).
 * Múltiplos reloads/eventos da mesma session_id contam como 1 em cada etapa.
 *
 * Ignora eventos anteriores a FUNNEL_CUTOFF_ISO (data da migração para
 * o modelo visitor_id/session_id).
 */
export const getFunnelData = async (startDate: string, endDate: string): Promise<FunnelResult> => {
  const requestedStart = new Date(`${startDate}T00:00:00`).toISOString();
  // Garante que não consultamos antes do cutoff
  const startIso = requestedStart < FUNNEL_CUTOFF_ISO ? FUNNEL_CUTOFF_ISO : requestedStart;
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from('product_events' as any)
    .select('product_id, product_name, event_type, quantity, session_id, category, items')
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .in('event_type', [
      'view_item',
      'add_to_cart',
      'purchase',
      'begin_checkout',
      'visita_cardapio_nova',
      'visita_cardapio_recorrente',
    ]);

  if (error || !data) {
    console.error('Error fetching funnel data:', error);
    return {
      perProduct: [],
      globals: {
        menuVisits: 0,
        beginCheckout: 0,
        viewItemSessions: 0,
        addToCartSessions: 0,
        purchaseSessions: 0,
      },
    };
  }

  // Globais: sessões únicas que tiveram cada evento (qualquer produto)
  const visitSessions = new Set<string>();
  const checkoutSessions = new Set<string>();
  const viewItemSessions = new Set<string>();
  const addToCartSessions = new Set<string>();
  const purchaseSessions = new Set<string>();

  // Por produto: sessões únicas por etapa + total de purchases (quantidade vendida real)
  const productInfo = new Map<string, { product_name: string }>();
  const viewSessionsByProduct = new Map<string, Set<string>>();
  const cartSessionsByProduct = new Map<string, Set<string>>();
  const purchaseSessionsByProduct = new Map<string, Set<string>>();
  const purchaseQtyByProduct = new Map<string, number>();

  const ensureProduct = (id: string, name: string) => {
    if (!productInfo.has(id)) productInfo.set(id, { product_name: name });
    if (!viewSessionsByProduct.has(id)) viewSessionsByProduct.set(id, new Set());
    if (!cartSessionsByProduct.has(id)) cartSessionsByProduct.set(id, new Set());
    if (!purchaseSessionsByProduct.has(id)) purchaseSessionsByProduct.set(id, new Set());
    if (!purchaseQtyByProduct.has(id)) purchaseQtyByProduct.set(id, 0);
  };

  (data as any[]).forEach((row: any) => {
    const sid = row.session_id || `__no_session__${row.product_id}__${row.event_type}`;

    if (row.event_type === 'visita_cardapio_nova' || row.event_type === 'visita_cardapio_recorrente') {
      visitSessions.add(sid);
      return;
    }
    if (row.event_type === 'begin_checkout') {
      checkoutSessions.add(sid);
      return;
    }

    // Brindes (cupom "compre e ganhe") não entram no funil de vendas
    if (row.category === 'brinde') return;

    // Evento de carrinho (purchase com array `items`): expande os produtos do JSONB
    if (row.event_type === 'purchase' && Array.isArray(row.items)) {
      purchaseSessions.add(sid);
      row.items.forEach((it: any) => {
        if (it?.category === 'brinde') return;
        const itemId = String(it?.product_id ?? '');
        if (!itemId) return;
        ensureProduct(itemId, it?.product_name ?? itemId);
        purchaseSessionsByProduct.get(itemId)!.add(sid);
        purchaseQtyByProduct.set(
          itemId,
          purchaseQtyByProduct.get(itemId)! + Number(it?.quantity ?? 1)
        );
      });
      return;
    }

    const id = row.product_id;
    ensureProduct(id, row.product_name);

    if (row.event_type === 'view_item') {
      viewSessionsByProduct.get(id)!.add(sid);
      viewItemSessions.add(sid);
    } else if (row.event_type === 'add_to_cart') {
      cartSessionsByProduct.get(id)!.add(sid);
      addToCartSessions.add(sid);
    } else if (row.event_type === 'purchase') {
      purchaseSessionsByProduct.get(id)!.add(sid);
      purchaseQtyByProduct.set(id, purchaseQtyByProduct.get(id)! + (row.quantity ?? 1));
      purchaseSessions.add(sid);
    }

  });

  const perProduct: FunnelData[] = Array.from(productInfo.entries()).map(([id, info]) => ({
    product_id: id,
    product_name: info.product_name,
    views: viewSessionsByProduct.get(id)!.size,
    addToCart: cartSessionsByProduct.get(id)!.size,
    // Mantém quantidade real comprada (não sessões), pois é a métrica de venda
    purchases: purchaseQtyByProduct.get(id)!,
  })).sort((a, b) => b.views - a.views);

  return {
    perProduct,
    globals: {
      menuVisits: visitSessions.size,
      beginCheckout: checkoutSessions.size,
      viewItemSessions: viewItemSessions.size,
      addToCartSessions: addToCartSessions.size,
      purchaseSessions: purchaseSessions.size,
    },
  };
};

// ---- Visitas ao cardápio: métricas agregadas para marketing-metrics ----

export interface VisitMetrics {
  /** Sessões únicas com evento de visita no período. */
  totalVisits: number;
  /** visitor_id únicos que visitaram no período. */
  uniqueVisitors: number;
  /** Visitas classificadas como novas (primeiro visitor_id). */
  newVisitors: number;
  /** Visitas classificadas como recorrentes. */
  returningVisitors: number;
  /** Total de páginas visualizadas (aberturas do cardápio + visualizações de produto). */
  pageViews: number;
  /** Média de visualizações por visita. */
  viewsPerVisit: number;
  /** Duração média por sessão, limitada a 30 minutos, em segundos. */
  averageVisitDurationSeconds: number;
}

/** Intervalo (ISO) já ajustado ao cutoff do funil. */
const rangeIso = (startDate: string, endDate: string) => {
  const requestedStart = new Date(`${startDate}T00:00:00`).toISOString();
  return {
    startIso: requestedStart < FUNNEL_CUTOFF_ISO ? FUNNEL_CUTOFF_ISO : requestedStart,
    endIso: new Date(`${endDate}T23:59:59.999`).toISOString(),
  };
};

/** Cache em memória das opções de UTM (mudam raramente). */
let utmOptionsCache: { sources: string[]; campaigns: string[] } | null = null;
let utmOptionsInflight: Promise<{ sources: string[]; campaigns: string[] }> | null = null;

export const getUtmOptions = async (): Promise<{ sources: string[]; campaigns: string[] }> => {
  if (utmOptionsCache) return utmOptionsCache;
  if (utmOptionsInflight) return utmOptionsInflight;

  utmOptionsInflight = (async () => {
    try {
      const { data, error } = await supabase.rpc('mkt_utm_options' as any);
      if (error || !data) {
        console.error('Error fetching utm options:', error);
        return { sources: [], campaigns: [] };
      }
      const sources: string[] = [];
      const campaigns: string[] = [];
      (data as any[]).forEach((row) => {
        if (!row?.value) return;
        if (row.kind === 'source') sources.push(row.value);
        else if (row.kind === 'campaign') campaigns.push(row.value);
      });
      utmOptionsCache = {
        sources: sources.sort((a, b) => a.localeCompare(b)),
        campaigns: campaigns.sort((a, b) => a.localeCompare(b)),
      };
      return utmOptionsCache;
    } finally {
      utmOptionsInflight = null;
    }
  })();

  return utmOptionsInflight;
};

/**
 * Lista todas as utm_source distintas encontradas em product_events
 * (usado para popular o filtro de "Origens" em marketing-metrics).
 */
export const getUtmSources = async (): Promise<string[]> => (await getUtmOptions()).sources;

/**
 * Lista todas as utm_campaign distintas encontradas em product_events
 * (usado para popular o filtro de "Campanhas" em marketing-metrics).
 */
export const getUtmCampaigns = async (): Promise<string[]> => (await getUtmOptions()).campaigns;

export const getVisitMetrics = async (
  startDate: string,
  endDate: string,
  utmSource?: string | null,
  utmCampaign?: string | null
): Promise<VisitMetrics> => {
  const { startIso, endIso } = rangeIso(startDate, endDate);

  const params = {
    p_start: startIso,
    p_end: endIso,
    p_source: utmSource ?? null,
    p_campaign: utmCampaign ?? null,
  };

  const [metricsResult, durationResult] = await Promise.all([
    supabase.rpc('mkt_visit_metrics' as any, params),
    supabase.rpc('mkt_avg_visit_duration' as any, params),
  ]);

  const { data, error } = metricsResult;
  const averageVisitDurationSeconds = durationResult.error
    ? 0
    : Number(durationResult.data ?? 0);

  if (durationResult.error) {
    console.error('Error fetching average visit duration:', durationResult.error);
  }

  const row = Array.isArray(data) ? (data as any[])[0] : (data as any);

  if (error || !row) {
    if (error) console.error('Error fetching visit metrics:', error);
    return {
      totalVisits: 0,
      uniqueVisitors: 0,
      newVisitors: 0,
      returningVisitors: 0,
      pageViews: 0,
      viewsPerVisit: 0,
      averageVisitDurationSeconds: 0,
    };
  }

  const totalVisits = Number(row.total_visits ?? 0);
  const pageViews = Number(row.page_views ?? 0);

  return {
    totalVisits,
    uniqueVisitors: Number(row.unique_visitors ?? 0),
    newVisitors: Number(row.new_visitors ?? 0),
    returningVisitors: Number(row.returning_visitors ?? 0),
    pageViews,
    viewsPerVisit: totalVisits > 0 ? pageViews / totalVisits : 0,
    averageVisitDurationSeconds,
  };
};

export type DailyMetricKey =
  | 'totalVisits'
  | 'uniqueVisitors'
  | 'newVisitors'
  | 'returningVisitors'
  | 'pageViews'
  | 'viewsPerVisit';

export interface DailyMetricRow {
  date: string; // yyyy-MM-dd
  value: number;
}

/**
 * Retorna série diária para uma métrica de visitas no período.
 * Dias sem dados retornam 0 para manter o eixo temporal contínuo.
 */
export const getDailyVisitMetrics = async (
  startDate: string,
  endDate: string,
  metric: DailyMetricKey,
  utmSource?: string | null,
  utmCampaign?: string | null
): Promise<DailyMetricRow[]> => {
  const { startIso, endIso } = rangeIso(startDate, endDate);

  const { data, error } = await supabase.rpc('mkt_daily_visit_metrics' as any, {
    p_start: startIso,
    p_end: endIso,
    p_source: utmSource ?? null,
    p_campaign: utmCampaign ?? null,
  });

  if (error) {
    console.error('Error fetching daily visit metrics:', error);
    return [];
  }

  const byDay = new Map<string, any>();
  ((data as any[]) ?? []).forEach((row) => {
    byDay.set(String(row.day).slice(0, 10), row);
  });

  const pick = (row: any): number => {
    const totalVisits = Number(row?.total_visits ?? 0);
    const pageViews = Number(row?.page_views ?? 0);
    switch (metric) {
      case 'totalVisits':
        return totalVisits;
      case 'uniqueVisitors':
        return Number(row?.unique_visitors ?? 0);
      case 'newVisitors':
        return Number(row?.new_visitors ?? 0);
      case 'returningVisitors':
        return Number(row?.returning_visitors ?? 0);
      case 'pageViews':
        return pageViews;
      case 'viewsPerVisit':
        return totalVisits > 0 ? pageViews / totalVisits : 0;
      default:
        return 0;
    }
  };

  // Preenche todos os dias do período para manter o eixo temporal contínuo
  const result: DailyMetricRow[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const totalDays = differenceInCalendarDays(end, start) + 1;

  for (let i = 0; i <= totalDays; i++) {
    const day = format(subDays(end, totalDays - i), 'yyyy-MM-dd');
    result.push({ date: day, value: pick(byDay.get(day)) });
  }

  return result;
};



// ---- Visitas ao cardápio: breakdown novas/recorrentes + UTM ----

export interface VisitsBreakdown {
  total: number;
  novas: number;
  recorrentes: number;
  bySource: Array<{ key: string; count: number }>;
  byMedium: Array<{ key: string; count: number }>;
  byCampaign: Array<{ key: string; count: number }>;
  byContent: Array<{ key: string; count: number }>;
}

const NOT_SET_LABEL = '(não definido)';

export const getMenuVisitsBreakdown = async (
  startDate: string,
  endDate: string
): Promise<VisitsBreakdown> => {
  const requestedStart = new Date(`${startDate}T00:00:00`).toISOString();
  const startIso = requestedStart < FUNNEL_CUTOFF_ISO ? FUNNEL_CUTOFF_ISO : requestedStart;
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from('product_events' as any)
    .select('event_type, session_id, utm_source, utm_medium, utm_campaign, utm_content')
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .in('event_type', ['visita_cardapio_nova', 'visita_cardapio_recorrente']);

  if (error || !data) {
    console.error('Error fetching menu visits breakdown:', error);
    return { total: 0, novas: 0, recorrentes: 0, bySource: [], byMedium: [], byCampaign: [], byContent: [] };
  }

  // Dedupe por session_id (uma sessão = uma visita)
  const seen = new Map<string, any>();
  (data as any[]).forEach((row) => {
    const sid = row.session_id || `__no_session__${Math.random()}`;
    // priorizar nova sobre recorrente se ambas existirem na mesma sessão
    if (!seen.has(sid) || row.event_type === 'visita_cardapio_nova') {
      seen.set(sid, row);
    }
  });

  const rows = Array.from(seen.values());
  const novas = rows.filter(r => r.event_type === 'visita_cardapio_nova').length;
  const recorrentes = rows.filter(r => r.event_type === 'visita_cardapio_recorrente').length;

  const tally = (field: string) => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const key = (r[field] as string) || NOT_SET_LABEL;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    total: rows.length,
    novas,
    recorrentes,
    bySource: tally('utm_source'),
    byMedium: tally('utm_medium'),
    byCampaign: tally('utm_campaign'),
    byContent: tally('utm_content'),
  };
};

// ---- Add to cart: total value and breakdown by product ----

export interface AddToCartProductRow {
  product_id: string;
  product_name: string;
  quantity: number;
  value: number;
  sessions: number;
}

export interface AddToCartBreakdown {
  totalValue: number;
  totalQuantity: number;
  totalSessions: number;
  totalEvents: number;
  byProduct: AddToCartProductRow[];
}

export const getAddToCartBreakdown = async (
  startDate: string,
  endDate: string
): Promise<AddToCartBreakdown> => {
  const requestedStart = new Date(`${startDate}T00:00:00`).toISOString();
  const startIso = requestedStart < FUNNEL_CUTOFF_ISO ? FUNNEL_CUTOFF_ISO : requestedStart;
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from('product_events' as any)
    .select('product_id, product_name, price, quantity, session_id')
    .eq('event_type', 'add_to_cart')
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (error || !data) {
    console.error('Error fetching add_to_cart breakdown:', error);
    return { totalValue: 0, totalQuantity: 0, totalSessions: 0, totalEvents: 0, byProduct: [] };
  }

  const map = new Map<string, { product_name: string; quantity: number; value: number; sessions: Set<string> }>();
  const allSessions = new Set<string>();
  let totalValue = 0;
  let totalQuantity = 0;

  (data as any[]).forEach((row) => {
    const qty = Number(row.quantity ?? 1);
    const price = Number(row.price ?? 0);
    const value = price * qty;
    totalValue += value;
    totalQuantity += qty;
    if (row.session_id) allSessions.add(row.session_id);

    const id = row.product_id;
    const existing = map.get(id) || { product_name: row.product_name, quantity: 0, value: 0, sessions: new Set<string>() };
    existing.quantity += qty;
    existing.value += value;
    if (row.session_id) existing.sessions.add(row.session_id);
    map.set(id, existing);
  });

  const byProduct: AddToCartProductRow[] = Array.from(map.entries())
    .map(([product_id, v]) => ({
      product_id,
      product_name: v.product_name,
      quantity: v.quantity,
      value: v.value,
      sessions: v.sessions.size,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    totalValue,
    totalQuantity,
    totalSessions: allSessions.size,
    totalEvents: data.length,
    byProduct,
  };
};

// ---- Begin checkout: tempo médio até finalizar a compra ----

const MAX_CHECKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

export interface CheckoutDurationBreakdown {
  /** Sessões que iniciaram checkout no período. */
  totalCheckoutSessions: number;
  /** Sessões que finalizaram (purchase ou checkout_finalize) com tempo válido (<=15min). */
  completedSessions: number;
  /** Sessões que iniciaram checkout mas não finalizaram (ou ultrapassaram 15min e/ou abandonaram). */
  notCompletedSessions: number;
  /** Sessões com abandoned_cart (>30min). */
  abandonedSessions: number;
  /** Sessões descartadas da média por excederem 15min entre begin_checkout e finalize. */
  excludedOver15min: number;
  /** Tempo médio em segundos entre begin_checkout e finalize, considerando apenas <=15min. */
  avgDurationSec: number;
  /** Mediana em segundos. */
  medianDurationSec: number;
  /** Menor duração considerada (segundos). */
  minDurationSec: number;
  /** Maior duração considerada (segundos). */
  maxDurationSec: number;
}

export const getCheckoutDurationBreakdown = async (
  startDate: string,
  endDate: string
): Promise<CheckoutDurationBreakdown> => {
  const requestedStart = new Date(`${startDate}T00:00:00`).toISOString();
  const startIso = requestedStart < FUNNEL_CUTOFF_ISO ? FUNNEL_CUTOFF_ISO : requestedStart;
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from('product_events' as any)
    .select('event_type, session_id, created_at')
    .in('event_type', ['begin_checkout', 'checkout_finalize', 'purchase', 'abandoned_cart'])
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (error || !data) {
    console.error('Error fetching checkout duration breakdown:', error);
    return {
      totalCheckoutSessions: 0,
      completedSessions: 0,
      notCompletedSessions: 0,
      abandonedSessions: 0,
      excludedOver15min: 0,
      avgDurationSec: 0,
      medianDurationSec: 0,
      minDurationSec: 0,
      maxDurationSec: 0,
    };
  }

  // Agrega por sessão: primeiro begin_checkout, primeiro finalize/purchase, qualquer abandoned_cart
  const sessions = new Map<string, { begin?: number; finalize?: number; abandoned?: boolean }>();

  (data as any[]).forEach((row) => {
    const sid = row.session_id;
    if (!sid) return;
    const ts = new Date(row.created_at).getTime();
    const entry = sessions.get(sid) || {};

    if (row.event_type === 'begin_checkout') {
      entry.begin = entry.begin === undefined ? ts : Math.min(entry.begin, ts);
    } else if (row.event_type === 'checkout_finalize' || row.event_type === 'purchase') {
      entry.finalize = entry.finalize === undefined ? ts : Math.min(entry.finalize, ts);
    } else if (row.event_type === 'abandoned_cart') {
      entry.abandoned = true;
    }
    sessions.set(sid, entry);
  });

  const durationsMs: number[] = [];
  let totalCheckout = 0;
  let abandoned = 0;
  let excluded = 0;
  let completed = 0;

  sessions.forEach((s) => {
    if (s.begin === undefined) return;
    totalCheckout += 1;
    if (s.abandoned) abandoned += 1;

    if (s.finalize !== undefined && s.finalize >= s.begin) {
      const diff = s.finalize - s.begin;
      if (diff <= MAX_CHECKOUT_DURATION_MS) {
        durationsMs.push(diff);
        completed += 1;
      } else {
        excluded += 1;
      }
    }
  });

  const sorted = [...durationsMs].sort((a, b) => a - b);
  const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : 0;

  return {
    totalCheckoutSessions: totalCheckout,
    completedSessions: completed,
    notCompletedSessions: Math.max(totalCheckout - completed, 0),
    abandonedSessions: abandoned,
    excludedOver15min: excluded,
    avgDurationSec: Math.round(avg / 1000),
    medianDurationSec: Math.round(median / 1000),
    minDurationSec: sorted.length ? Math.round(sorted[0] / 1000) : 0,
    maxDurationSec: sorted.length ? Math.round(sorted[sorted.length - 1] / 1000) : 0,
  };
};

// ---- Ticket médio: real (purchases efetivadas) vs carrinhos abandonados ----

export interface AbandonedTicketBreakdown {
  /** Ticket médio de pedidos efetivamente concluídos (pedidos_sabor_delivery, exclui cancelados). */
  avgRealTicket: number;
  /** Ticket médio dos carrinhos abandonados (>30min sem finalizar). */
  avgAbandonedTicket: number;
  /** Quantidade de carrinhos abandonados no período. */
  abandonedCount: number;
  /** Receita potencial perdida = avgAbandonedTicket * abandonedCount. */
  lostRevenue: number;
}

export const getAbandonedTicketBreakdown = async (
  startDate: string,
  endDate: string
): Promise<AbandonedTicketBreakdown> => {
  const requestedStart = new Date(`${startDate}T00:00:00`).toISOString();
  const startIso = requestedStart < FUNNEL_CUTOFF_ISO ? FUNNEL_CUTOFF_ISO : requestedStart;
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  // Real ticket: pedidos efetivados
  const { data: pedidos } = await supabase
    .from('pedidos_sabor_delivery')
    .select('valor_total, status_atual, criado_em')
    .gte('criado_em', startIso)
    .lte('criado_em', endIso);

  const validPedidos = (pedidos || []).filter((p: any) => {
    const s = (p.status_atual || '').toLowerCase();
    return s !== 'cancelado' && s !== 'cancelled' && Number(p.valor_total) > 0;
  });
  const avgRealTicket = validPedidos.length
    ? validPedidos.reduce((sum: number, p: any) => sum + Number(p.valor_total), 0) / validPedidos.length
    : 0;

  // Abandoned ticket: somar price*qty por sessão de abandoned_cart
  const { data: abandoned } = await supabase
    .from('product_events' as any)
    .select('session_id, price, quantity, items')
    .eq('event_type', 'abandoned_cart')
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  const sessionTotals = new Map<string, number>();
  (abandoned as any[] || []).forEach((row) => {
    const sid = row.session_id;
    if (!sid) return;
    const v = eventTotalValue(row);


    sessionTotals.set(sid, (sessionTotals.get(sid) || 0) + v);
  });

  const abandonedTotals = Array.from(sessionTotals.values()).filter(v => v > 0);
  const avgAbandonedTicket = abandonedTotals.length
    ? abandonedTotals.reduce((a, b) => a + b, 0) / abandonedTotals.length
    : 0;
  const abandonedCount = abandonedTotals.length;
  const lostRevenue = avgAbandonedTicket * abandonedCount;

  return { avgRealTicket, avgAbandonedTicket, abandonedCount, lostRevenue };
};

// ---- Compras efetivadas (etapa 5 do funil) ----

export interface PurchasesBreakdown {
  totalRevenue: number;
  totalOrders: number;
  avgTicket: number;
  byPaymentMethod: Array<{ method: string; count: number; revenue: number; pct: number }>;
  topHours: Array<{ hour: number; orders: number; revenue: number }>;
  topDays: Array<{ dayOfWeek: number; label: string; orders: number; revenue: number }>;
}

const PAYMENT_LABELS: Record<string, string> = {
  card: 'Cartão',
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'PIX',
  cash: 'Dinheiro',
  money: 'Dinheiro',
};

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const getPurchasesBreakdown = async (
  startDate: string,
  endDate: string
): Promise<PurchasesBreakdown> => {
  const startIso = new Date(`${startDate}T00:00:00`).toISOString();
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from('pedidos_sabor_delivery')
    .select('valor_total, status_atual, metodo_pagamento, criado_em')
    .gte('criado_em', startIso)
    .lte('criado_em', endIso);

  if (error || !data) {
    return {
      totalRevenue: 0, totalOrders: 0, avgTicket: 0,
      byPaymentMethod: [], topHours: [], topDays: [],
    };
  }

  const valid = (data as any[]).filter((p) => {
    const s = (p.status_atual || '').toLowerCase();
    return s !== 'cancelado' && s !== 'cancelled' && Number(p.valor_total) > 0;
  });

  const totalRevenue = valid.reduce((s, p) => s + Number(p.valor_total), 0);
  const totalOrders = valid.length;
  const avgTicket = totalOrders ? totalRevenue / totalOrders : 0;

  // Payment methods
  const payMap = new Map<string, { count: number; revenue: number }>();
  valid.forEach((p) => {
    const raw = (p.metodo_pagamento || 'não informado').toString().toLowerCase();
    const label = PAYMENT_LABELS[raw] || raw;
    const e = payMap.get(label) || { count: 0, revenue: 0 };
    e.count += 1;
    e.revenue += Number(p.valor_total);
    payMap.set(label, e);
  });
  const byPaymentMethod = Array.from(payMap.entries())
    .map(([method, v]) => ({
      method,
      count: v.count,
      revenue: v.revenue,
      pct: totalOrders ? (v.count / totalOrders) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Hours
  const hourMap = new Map<number, { orders: number; revenue: number }>();
  const dayMap = new Map<number, { orders: number; revenue: number }>();
  valid.forEach((p) => {
    const d = new Date(p.criado_em);
    const h = d.getHours();
    const dow = d.getDay();
    const he = hourMap.get(h) || { orders: 0, revenue: 0 };
    he.orders += 1; he.revenue += Number(p.valor_total);
    hourMap.set(h, he);
    const de = dayMap.get(dow) || { orders: 0, revenue: 0 };
    de.orders += 1; de.revenue += Number(p.valor_total);
    dayMap.set(dow, de);
  });

  const topHours = Array.from(hourMap.entries())
    .map(([hour, v]) => ({ hour, ...v }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 3);

  const topDays = Array.from(dayMap.entries())
    .map(([dayOfWeek, v]) => ({ dayOfWeek, label: DAY_NAMES[dayOfWeek], ...v }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 3);

  return { totalRevenue, totalOrders, avgTicket, byPaymentMethod, topHours, topDays };
};

// ---- Product views (Etapa 2): top categorias, top produtos, vitrine, lista completa ----

export interface ProductViewRow {
  product_id: string;
  product_name: string;
  category: string | null;
  views: number;
  addToCart: number;
  conversion: number; // 0..100
}

export interface CategoryViewRow {
  category: string;
  views: number;
}

export interface ProductViewsBreakdown {
  totalViews: number;
  totalAddToCart: number;
  uniqueProducts: number;
  topCategories: CategoryViewRow[]; // top 3
  topProducts: ProductViewRow[]; // top 5 by views
  showcase: ProductViewRow[]; // top 3 mais vistos com conversão < 40%
  fullList: ProductViewRow[]; // todos, ordenado por views desc
}

const SHOWCASE_CONVERSION_THRESHOLD = 40;
const SHOWCASE_MIN_VIEWS = 5;

export const getProductViewsBreakdown = async (
  startDate: string,
  endDate: string
): Promise<ProductViewsBreakdown> => {
  const requestedStart = new Date(`${startDate}T00:00:00`).toISOString();
  const startIso = requestedStart < FUNNEL_CUTOFF_ISO ? FUNNEL_CUTOFF_ISO : requestedStart;
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from('product_events' as any)
    .select('product_id, product_name, category, event_type, session_id')
    .in('event_type', ['view_item', 'add_to_cart'])
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (error || !data) {
    console.error('Error fetching product views breakdown:', error);
    return { totalViews: 0, totalAddToCart: 0, uniqueProducts: 0, topCategories: [], topProducts: [], showcase: [], fullList: [] };
  }

  const productMap = new Map<string, { name: string; category: string | null; views: number; addToCart: number }>();
  const categoryMap = new Map<string, number>();
  let totalViews = 0;
  let totalAddToCart = 0;

  (data as any[]).forEach((row) => {
    const id = row.product_id;
    const existing = productMap.get(id) || { name: row.product_name, category: row.category ?? null, views: 0, addToCart: 0 };
    if (row.category && !existing.category) existing.category = row.category;
    if (row.event_type === 'view_item') {
      existing.views++;
      totalViews++;
      const cat = row.category || NOT_SET_LABEL;
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    } else if (row.event_type === 'add_to_cart') {
      existing.addToCart++;
      totalAddToCart++;
    }
    productMap.set(id, existing);
  });

  const fullList: ProductViewRow[] = Array.from(productMap.entries())
    .filter(([, v]) => v.views > 0)
    .map(([product_id, v]) => ({
      product_id,
      product_name: v.name,
      category: v.category,
      views: v.views,
      addToCart: v.addToCart,
      conversion: v.views > 0 ? (v.addToCart / v.views) * 100 : 0,
    }))
    .sort((a, b) => b.views - a.views);

  const topCategories: CategoryViewRow[] = Array.from(categoryMap.entries())
    .map(([category, views]) => ({ category, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);

  const topProducts = fullList.slice(0, 5);

  const showcase = fullList
    .filter((p) => p.views >= SHOWCASE_MIN_VIEWS && p.conversion < SHOWCASE_CONVERSION_THRESHOLD)
    .slice(0, 3);

  return {
    totalViews,
    totalAddToCart,
    uniqueProducts: fullList.length,
    topCategories,
    topProducts,
    showcase,
    fullList,
  };
};

// ---- Funil completo para a aba "Funil" de marketing-metrics ----

export interface FunnelStageCounts {
  visits: number;
  itemViews: number;
  addToCart: number;
  beginCheckout: number;
  endCheckout: number;
  purchases: number;
}

export interface FunnelDailyPoint {
  date: string; // yyyy-MM-dd
  abandonoCarrinho: number;
  desistenciaCheckout: number;
  tempoCheckout: number;
  pedidosIniciados: number;
  pedidosFinalizados: number;
  /** % de sessões de visita que finalizaram pedido (compras / visitas). */
  taxaConversao: number;
}

export interface FunnelOverview {
  stages: FunnelStageCounts;
  /** % de sessões que adicionaram ao carrinho e não iniciaram o checkout. */
  abandonoCarrinho: number;
  /** % de sessões que iniciaram o checkout e não compraram. */
  desistenciaCheckout: number;
  /** Tempo médio (segundos) entre begin_checkout e finalize. */
  tempoCheckout: number;
  /** Sessões que iniciaram checkout. */
  pedidosIniciados: number;
  /** Sessões que concluíram a compra. */
  pedidosFinalizados: number;
  /** % de visitas ao cardápio que finalizaram pedido (compras / visitas). */
  taxaConversao: number;
  daily: FunnelDailyPoint[];
}

const emptyFunnelOverview = (): FunnelOverview => ({
  stages: { visits: 0, itemViews: 0, addToCart: 0, beginCheckout: 0, endCheckout: 0, purchases: 0 },
  abandonoCarrinho: 0,
  desistenciaCheckout: 0,
  tempoCheckout: 0,
  pedidosIniciados: 0,
  pedidosFinalizados: 0,
  taxaConversao: 0,
  daily: [],
});

export const getFunnelOverview = async (
  startDate: string,
  endDate: string,
  utmSource?: string | null,
  utmCampaign?: string | null
): Promise<FunnelOverview> => {
  const { startIso, endIso } = rangeIso(startDate, endDate);

  const { data, error } = await supabase.rpc('mkt_funnel_overview' as any, {
    p_start: startIso,
    p_end: endIso,
    p_source: utmSource ?? null,
    p_campaign: utmCampaign ?? null,
  });

  if (error || !data) {
    if (error) console.error('Error fetching funnel overview:', error);
    return emptyFunnelOverview();
  }

  const payload = (Array.isArray(data) ? data[0] : data) as any;
  const s = payload?.stages ?? {};

  const stages: FunnelStageCounts = {
    visits: Number(s.visits ?? 0),
    itemViews: Number(s.item_views ?? 0),
    addToCart: Number(s.add_to_cart ?? 0),
    beginCheckout: Number(s.begin_checkout ?? 0),
    endCheckout: Number(s.end_checkout ?? 0),
    purchases: Number(s.purchases ?? 0),
  };

  const daily: FunnelDailyPoint[] = ((payload?.daily as any[]) ?? []).map((d) => {
    const visits = Number(d.visits ?? 0);
    const addToCart = Number(d.addToCart ?? 0);
    const beginCheckout = Number(d.beginCheckout ?? 0);
    const purchases = Number(d.purchases ?? 0);
    return {
      date: String(d.date).slice(0, 10),
      abandonoCarrinho: addToCart > 0 ? Math.max(0, (1 - beginCheckout / addToCart) * 100) : 0,
      desistenciaCheckout: beginCheckout > 0 ? Math.max(0, (1 - purchases / beginCheckout) * 100) : 0,
      tempoCheckout: Number(d.avgCheckoutSeconds ?? 0),
      pedidosIniciados: beginCheckout,
      pedidosFinalizados: purchases,
      taxaConversao: visits > 0 ? (purchases / visits) * 100 : 0,
    };
  });

  return {
    stages,
    abandonoCarrinho:
      stages.addToCart > 0 ? Math.max(0, (1 - stages.beginCheckout / stages.addToCart) * 100) : 0,
    desistenciaCheckout:
      stages.beginCheckout > 0 ? Math.max(0, (1 - stages.purchases / stages.beginCheckout) * 100) : 0,
    tempoCheckout: Number(payload?.avgCheckoutSeconds ?? 0),
    pedidosIniciados: stages.beginCheckout,
    pedidosFinalizados: stages.purchases,
    taxaConversao: stages.visits > 0 ? (stages.purchases / stages.visits) * 100 : 0,
    daily,
  };
};


// ---- Valor potencial perdido em carrinhos abandonados ----

/** Soma price*quantity de todos os itens dos eventos abandoned_cart no período. */
export const getAbandonedCartLostValue = async (
  startDate: string,
  endDate: string,
  utmSource?: string | null,
  utmCampaign?: string | null
): Promise<number> => {
  const { startIso, endIso } = rangeIso(startDate, endDate);

  let query = supabase
    .from('product_events' as any)
    .select('price, quantity, items')
    .eq('event_type', 'abandoned_cart')
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (utmSource) query = query.eq('utm_source', utmSource);
  if (utmCampaign) query = query.eq('utm_campaign', utmCampaign);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching abandoned cart lost value:', error);
    return 0;
  }

  return ((data as any[]) || []).reduce((sum, row) => sum + eventTotalValue(row), 0);

};

/** Soma price*quantity dos itens de begin_checkout em sessões que NÃO concluíram a compra. */
export const getAbandonedCheckoutLostValue = async (
  startDate: string,
  endDate: string,
  utmSource?: string | null,
  utmCampaign?: string | null
): Promise<number> => {
  const { startIso, endIso } = rangeIso(startDate, endDate);

  let query = supabase
    .from('product_events' as any)
    .select('session_id, price, quantity, items, event_type')
    .in('event_type', ['begin_checkout', 'purchase'])
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (utmSource) query = query.eq('utm_source', utmSource);
  if (utmCampaign) query = query.eq('utm_campaign', utmCampaign);

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching abandoned checkout lost value:', error);
    return 0;
  }

  const rows = (data as any[]) || [];
  const purchaseSessions = new Set(
    rows.filter((r) => r.event_type === 'purchase').map((r) => r.session_id)
  );

  return rows
    .filter(
      (r) =>
        r.event_type === 'begin_checkout' &&
        r.session_id &&
        !purchaseSessions.has(r.session_id)
    )
    .reduce((sum, row) => sum + eventTotalValue(row), 0);

};

// ---- Taxa de rejeição ----

export interface BounceRate {
  totalSessions: number;
  bouncedSessions: number;
  bouncedNew: number;
  bouncedReturning: number;
  /** Percentual (0-100) de sessões com apenas um evento no período. */
  rate: number;
}

/**
 * Percentual de sessões que tiveram apenas UM evento no período
 * (geralmente somente a visita ao cardápio, nova ou recorrente).
 */
export const getBounceRate = async (
  startDate: string,
  endDate: string,
  utmSource?: string | null,
  utmCampaign?: string | null
): Promise<BounceRate> => {
  const { startIso, endIso } = rangeIso(startDate, endDate);

  const { data, error } = await supabase.rpc('mkt_bounce_rate' as any, {
    p_start: startIso,
    p_end: endIso,
    p_source: utmSource ?? null,
    p_campaign: utmCampaign ?? null,
  });

  const row = Array.isArray(data) ? (data as any[])[0] : (data as any);

  if (error || !row) {
    if (error) console.error('Error fetching bounce rate:', error);
    return { totalSessions: 0, bouncedSessions: 0, bouncedNew: 0, bouncedReturning: 0, rate: 0 };
  }

  const totalSessions = Number(row.total_sessions ?? 0);
  const bouncedSessions = Number(row.bounced_sessions ?? 0);

  return {
    totalSessions,
    bouncedSessions,
    bouncedNew: Number(row.bounced_new ?? 0),
    bouncedReturning: Number(row.bounced_returning ?? 0),
    rate: totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0,
  };
};

// ---- Ranking de produtos para a aba "Produtos" de marketing-metrics ----

export interface ProductRankRow {
  productId: string;
  productName: string;
  value: number;
}

export type ProductMetricKey = 'productViews' | 'productSales';

export interface ProductRankingMetrics {
  topViewed: ProductRankRow[];
  topSold: ProductRankRow[];
  totalViews: number;
  totalSales: number;
  dailyViews: DailyMetricRow[];
  dailySales: DailyMetricRow[];
}

const emptyProductRanking: ProductRankingMetrics = {
  topViewed: [],
  topSold: [],
  totalViews: 0,
  totalSales: 0,
  dailyViews: [],
  dailySales: [],
};

/**
 * Visualizações (view_item) e vendas (purchase, incluindo os produtos do JSONB
 * `items`) por produto no período, respeitando os filtros de origem/campanha.
 * Brindes são ignorados nas vendas.
 */
export const getProductRankingMetrics = async (
  startDate: string,
  endDate: string,
  utmSource?: string | null,
  utmCampaign?: string | null,
): Promise<ProductRankingMetrics> => {
  const { startIso, endIso } = rangeIso(startDate, endDate);
  const key = `product-ranking:${startIso}:${endIso}:${utmSource ?? ''}:${utmCampaign ?? ''}`;

  return cachedFetch(key, async () => {
    let query = supabase
      .from('product_events' as any)
      .select('product_id, product_name, event_type, quantity, category, items, created_at')
      .in('event_type', ['view_item', 'purchase'])
      .gte('created_at', startIso)
      .lte('created_at', endIso);

    if (utmSource) query = query.eq('utm_source', utmSource);
    if (utmCampaign) query = query.eq('utm_campaign', utmCampaign);

    const { data, error } = await query;
    if (error || !data) {
      if (error) console.error('Error fetching product ranking metrics:', error);
      return emptyProductRanking;
    }

    const views = new Map<string, { name: string; value: number }>();
    const sales = new Map<string, { name: string; value: number }>();
    const dailyViews = new Map<string, number>();
    const dailySales = new Map<string, number>();

    const bump = (
      map: Map<string, { name: string; value: number }>,
      id: string,
      name: string,
      qty: number,
    ) => {
      if (!id) return;
      const entry = map.get(id) ?? { name: name || id, value: 0 };
      if (name) entry.name = name;
      entry.value += qty;
      map.set(id, entry);
    };

    (data as any[]).forEach((row) => {
      const day = String(row.created_at ?? '').slice(0, 10);

      if (row.event_type === 'view_item') {
        if (row.category === 'brinde') return;
        bump(views, String(row.product_id ?? ''), row.product_name ?? '', 1);
        dailyViews.set(day, (dailyViews.get(day) ?? 0) + 1);
        return;
      }

      // purchase
      if (Array.isArray(row.items)) {
        row.items.forEach((it: any) => {
          if (it?.category === 'brinde') return;
          const qty = Number(it?.quantity ?? 1);
          bump(sales, String(it?.product_id ?? ''), it?.product_name ?? '', qty);
          dailySales.set(day, (dailySales.get(day) ?? 0) + qty);
        });
        return;
      }

      if (row.category === 'brinde') return;
      const qty = Number(row.quantity ?? 1);
      bump(sales, String(row.product_id ?? ''), row.product_name ?? '', qty);
      dailySales.set(day, (dailySales.get(day) ?? 0) + qty);
    });

    const toRows = (map: Map<string, { name: string; value: number }>): ProductRankRow[] =>
      Array.from(map.entries())
        .map(([productId, v]) => ({ productId, productName: v.name, value: v.value }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value);

    const viewRows = toRows(views);
    const saleRows = toRows(sales);

    const toSeries = (map: Map<string, number>): DailyMetricRow[] =>
      Array.from(map.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));

    return {
      topViewed: viewRows.slice(0, 5),
      topSold: saleRows.slice(0, 5),
      totalViews: viewRows.reduce((acc, r) => acc + r.value, 0),
      totalSales: saleRows.reduce((acc, r) => acc + r.value, 0),
      dailyViews: toSeries(dailyViews),
      dailySales: toSeries(dailySales),
    };
  }, 60_000);
};
