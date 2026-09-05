import { supabase } from '@/integrations/supabase/client';
import { getSessionId, getVisitorId } from '@/utils/sessionId';
import { getUtmParams } from '@/utils/utmCapture';
import { format, subDays, differenceInCalendarDays } from 'date-fns';

/**
 * Marco temporal: o painel de inteligência ignora eventos anteriores a esta data,
 * pois eles foram registrados antes da introdução de visitor_id/session_id.
 */
export const FUNNEL_CUTOFF_ISO = '2026-04-27T00:00:00.000Z';

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
 * Persists multiple product events at once (e.g. purchase with multiple items).
 */
export const trackProductEventsBatch = (items: ProductEventPayload[]) => {
  const sessionId = getSessionId();
  const visitorId = getVisitorId();
  const utms = getUtmParams();

  const rows = items.map(item => ({
    product_id: item.product_id,
    product_name: item.product_name,
    event_type: item.event_type,
    price: item.price ?? 0,
    category: item.category ?? null,
    quantity: item.quantity ?? 1,
    session_id: sessionId,
    visitor_id: visitorId,
    utm_source: utms.utm_source ?? null,
    utm_medium: utms.utm_medium ?? null,
    utm_campaign: utms.utm_campaign ?? null,
    utm_content: utms.utm_content ?? null,
    utm_term: utms.utm_term ?? null,
  }));

  supabase
    .from('product_events' as any)
    .insert(rows)
    .then(({ error }) => {
      if (error) console.error('Error tracking product events batch:', error);
    });
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
    .select('product_id, product_name, event_type, quantity, category')
    ;

  if (error || !data) {
    console.error('Error fetching product metrics:', error);
    return [];
  }

  const metricsMap = new Map<string, ProductMetric>();

  (data as any[]).forEach((row: any) => {
    // Brindes (cupom "compre e ganhe") nunca entram nas métricas de vendas
    if (row.category === 'brinde') return;
    const key = row.product_id;
    if (!metricsMap.has(key)) {
      metricsMap.set(key, {
        product_id: row.product_id,
        product_name: row.product_name,
        views: 0,
        sales: 0,
      });
    }
    const m = metricsMap.get(key)!;
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
    .select('product_id, product_name, event_type, quantity, session_id, category')
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
}

/**
 * Lista todas as utm_source distintas encontradas em product_events
 * (usado para popular o filtro de "Origens" em marketing-metrics).
 */
export const getUtmSources = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('product_events' as any)
    .select('utm_source')
    .not('utm_source', 'is', null);

  if (error || !data) {
    console.error('Error fetching utm sources:', error);
    return [];
  }

  const set = new Set<string>();
  (data as any[]).forEach((row) => {
    const s = (row.utm_source || '').trim();
    if (s) set.add(s);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

/**
 * Lista todas as utm_campaign distintas encontradas em product_events
 * (usado para popular o filtro de "Campanhas" em marketing-metrics).
 */
export const getUtmCampaigns = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('product_events' as any)
    .select('utm_campaign')
    .not('utm_campaign', 'is', null);

  if (error || !data) {
    console.error('Error fetching utm campaigns:', error);
    return [];
  }

  const set = new Set<string>();
  (data as any[]).forEach((row) => {
    const s = (row.utm_campaign || '').trim();
    if (s) set.add(s);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

export const getVisitMetrics = async (
  startDate: string,
  endDate: string,
  utmSource?: string | null,
  utmCampaign?: string | null
): Promise<VisitMetrics> => {
  const requestedStart = new Date(`${startDate}T00:00:00`).toISOString();
  const startIso = requestedStart < FUNNEL_CUTOFF_ISO ? FUNNEL_CUTOFF_ISO : requestedStart;
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  let query = supabase
    .from('product_events' as any)
    .select('event_type, session_id, visitor_id')
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .in('event_type', ['visita_cardapio_nova', 'visita_cardapio_recorrente', 'view_item']);

  if (utmSource) {
    query = query.eq('utm_source', utmSource);
  }
  if (utmCampaign) {
    query = query.eq('utm_campaign', utmCampaign);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching visit metrics:', error);
    return {
      totalVisits: 0,
      uniqueVisitors: 0,
      newVisitors: 0,
      returningVisitors: 0,
      pageViews: 0,
      viewsPerVisit: 0,
    };
  }

  // Dedupe por sessão (uma sessão = uma visita); nova tem prioridade sobre recorrente
  const sessions = new Map<string, string>(); // sid -> event_type
  const visitors = new Set<string>();
  let pageViews = 0;

  (data as any[]).forEach((row) => {
    const isVisit =
      row.event_type === 'visita_cardapio_nova' || row.event_type === 'visita_cardapio_recorrente';
    // Cada abertura do cardápio e cada visualização de produto conta como page view
    pageViews += 1;

    if (!isVisit) return;

    const sid = row.session_id || `__no_session__${Math.random()}`;
    if (!sessions.has(sid) || row.event_type === 'visita_cardapio_nova') {
      sessions.set(sid, row.event_type);
    }
    if (row.visitor_id) visitors.add(row.visitor_id);
  });

  let newVisitors = 0;
  let returningVisitors = 0;
  sessions.forEach((type) => {
    if (type === 'visita_cardapio_nova') newVisitors += 1;
    else returningVisitors += 1;
  });

  return {
    totalVisits: sessions.size,
    uniqueVisitors: visitors.size,
    newVisitors,
    returningVisitors,
    pageViews,
    viewsPerVisit: sessions.size > 0 ? pageViews / sessions.size : 0,
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
  const requestedStart = new Date(`${startDate}T00:00:00`).toISOString();
  const startIso = requestedStart < FUNNEL_CUTOFF_ISO ? FUNNEL_CUTOFF_ISO : requestedStart;
  const endIso = new Date(`${endDate}T23:59:59.999`).toISOString();

  let query = supabase
    .from('product_events' as any)
    .select('event_type, session_id, visitor_id, created_at')
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .in('event_type', ['visita_cardapio_nova', 'visita_cardapio_recorrente', 'view_item']);

  if (utmSource) {
    query = query.eq('utm_source', utmSource);
  }
  if (utmCampaign) {
    query = query.eq('utm_campaign', utmCampaign);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching daily visit metrics:', error);
    return [];
  }

  // Agrupa eventos por dia local (yyyy-MM-dd)
  const byDay = new Map<string, { events: any[] }>();

  (data as any[]).forEach((row) => {
    const day = format(new Date(row.created_at), 'yyyy-MM-dd');
    if (!byDay.has(day)) byDay.set(day, { events: [] });
    byDay.get(day)!.events.push(row);
  });

  // Preenche todos os dias do período
  const result: DailyMetricRow[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const totalDays = differenceInCalendarDays(end, start) + 1;

  for (let i = 0; i <= totalDays; i++) {
    const day = format(subDays(end, totalDays - i), 'yyyy-MM-dd');
    const events = byDay.get(day)?.events || [];

    const sessions = new Map<string, string>(); // sid -> event_type
    const visitors = new Set<string>();
    let pageViews = 0;

    events.forEach((row) => {
      const isVisit =
        row.event_type === 'visita_cardapio_nova' || row.event_type === 'visita_cardapio_recorrente';
      pageViews += 1;

      if (!isVisit) return;

      const sid = row.session_id || `__no_session__${Math.random()}`;
      if (!sessions.has(sid) || row.event_type === 'visita_cardapio_nova') {
        sessions.set(sid, row.event_type);
      }
      if (row.visitor_id) visitors.add(row.visitor_id);
    });

    let newVisitors = 0;
    let returningVisitors = 0;
    sessions.forEach((type) => {
      if (type === 'visita_cardapio_nova') newVisitors += 1;
      else returningVisitors += 1;
    });

    const totalVisits = sessions.size;
    const uniqueVisitors = visitors.size;

    let value = 0;
    switch (metric) {
      case 'totalVisits':
        value = totalVisits;
        break;
      case 'uniqueVisitors':
        value = uniqueVisitors;
        break;
      case 'newVisitors':
        value = newVisitors;
        break;
      case 'returningVisitors':
        value = returningVisitors;
        break;
      case 'pageViews':
        value = pageViews;
        break;
      case 'viewsPerVisit':
        value = totalVisits > 0 ? pageViews / totalVisits : 0;
        break;
    }

    result.push({ date: day, value });
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
    .select('session_id, price, quantity')
    .eq('event_type', 'abandoned_cart')
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  const sessionTotals = new Map<string, number>();
  (abandoned as any[] || []).forEach((row) => {
    const sid = row.session_id;
    if (!sid) return;
    const v = Number(row.price ?? 0) * Number(row.quantity ?? 1);
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
