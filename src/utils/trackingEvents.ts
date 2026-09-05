/**
 * Tracking events utility — fires Meta Pixel + GTM dataLayer events
 * with rich parameters for all standard e-commerce events.
 *
 * User identity:
 *   • GA4:  user_id (Firebase UID) injected in every dataLayer push
 *   • Meta: external_id (SHA-256 of Firebase UID) sent in every fbq event
 */

import { CartItem } from '@/types/menu';
import { supabase } from '@/integrations/supabase/client';
import { trackProductEvent, trackProductEventsBatch } from '@/services/productEventService';
import { resolveSession } from '@/utils/sessionId';

// ─── Helpers ──────────────────────────────────────────────

const fbq = (...args: any[]) => window.fbq?.(...args);

/** Returns the Supabase user ID of the currently authenticated user, or null. */
let cachedUid: string | null = null;
supabase.auth.onAuthStateChange((_e, session) => {
  cachedUid = session?.user?.id ?? null;
});
supabase.auth.getSession().then(({ data: { session } }) => {
  cachedUid = session?.user?.id ?? null;
});
const getFirebaseUid = (): string | null => cachedUid;

/** SHA-256 hash (hex) — used to hash external_id for Meta. */
const sha256 = async (str: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

/** Cached hashed UID for Meta external_id */
let _cachedHashedUid: string | null = null;
let _cachedRawUid: string | null = null;

const getHashedUid = async (): Promise<string | null> => {
  const uid = getFirebaseUid();
  if (!uid) return null;
  if (uid === _cachedRawUid && _cachedHashedUid) return _cachedHashedUid;
  _cachedRawUid = uid;
  _cachedHashedUid = await sha256(uid);
  return _cachedHashedUid;
};

/** Fire fbq with external_id (async, fire-and-forget). */
const fbqWithUid = (event: string, eventName: string, params: Record<string, any>) => {
  getHashedUid().then(hashedUid => {
    fbq(event, eventName, {
      ...params,
      ...(hashedUid ? { external_id: hashedUid } : {}),
    });
  });
};

const pushDataLayer = (payload: Record<string, any>) => {
  window.dataLayer = window.dataLayer || [];
  // Inject user_id into every dataLayer push for GA4 User-ID
  const uid = getFirebaseUid();
  const enriched = uid ? { ...payload, user_id: uid } : payload;
  window.dataLayer.push(enriched);
};

const formatVariations = (item: CartItem) => {
  if (!item.selectedVariations?.length) return undefined;
  return item.selectedVariations.flatMap((group) =>
    group.variations
      .filter((v) => v.quantity > 0)
      .map((v) => ({
        group: group.groupName,
        name: v.name || v.variationId,
        qty: v.quantity,
        price: v.additionalPrice || 0,
        half: v.halfSelection || null,
      }))
  );
};

const buildItemPayload = (item: CartItem, index?: number) => {
  const variations = formatVariations(item);
  const border = item.selectedBorder
    ? { name: item.selectedBorder.name, price: item.selectedBorder.additionalPrice }
    : undefined;

  return {
    item_id: item.id,
    item_name: item.name,
    item_category: item.category,
    price: item.price,
    quantity: item.quantity,
    index,
    ...(item.isHalfPizza && item.combination
      ? {
          item_variant: `${item.combination.sabor1.name} / ${item.combination.sabor2.name}`,
          pizza_size: item.combination.tamanho,
          is_half_pizza: true,
        }
      : {}),
    ...(border ? { border_name: border.name, border_price: border.price } : {}),
    ...(variations?.length ? { variations } : {}),
  };
};

const calculateItemValue = (item: CartItem): number => {
  let base = item.priceFrom ? 0 : item.price || 0;
  if (item.selectedVariations?.length) {
    item.selectedVariations.forEach((g) =>
      g.variations.forEach((v) => {
        const p = v.additionalPrice || 0;
        const mult = item.isHalfPizza && v.halfSelection === 'whole' ? 2 : 1;
        base += p * (v.quantity || 1) * mult;
      })
    );
  }
  if (item.selectedBorder?.additionalPrice) base += item.selectedBorder.additionalPrice;
  return base * (item.quantity || 1);
};

// ─── Events ───────────────────────────────────────────────

/**
 * MenuVisit — disparado quando o usuário acessa o cardápio.
 *
 * Usa visitor_id (persistente) + session_id (sliding window de 30min) para:
 *  - NÃO contar reload/navegação dentro da mesma sessão como nova visita
 *  - Diferenciar visitante NOVO (primeiro visitor_id) de RECORRENTE (visitor já existia)
 *
 * Só registra evento quando uma nova sessão começa.
 */
// Flag em memória — evita disparo duplicado dentro do mesmo page load (StrictMode, etc.).
// Não usamos localStorage como gate porque o funil depende de inserir o evento e a
// deduplicação por sessão já é feita na agregação (Set<session_id>).
let _menuVisitTrackedInThisLoad = false;

export const trackMenuVisit = () => {
  try {
    if (_menuVisitTrackedInThisLoad) return;
    _menuVisitTrackedInThisLoad = true;

    resolveSession();

    // Classificação nova/recorrente baseada no visitor_id persistente.
    const FIRST_VISIT_KEY = 'lov_visitor_first_visit_done';
    let firstVisitDone = false;
    try {
      firstVisitDone = localStorage.getItem(FIRST_VISIT_KEY) === '1';
      if (!firstVisitDone) localStorage.setItem(FIRST_VISIT_KEY, '1');
    } catch { /* noop */ }

    const isReturning = firstVisitDone;
    const eventType = isReturning ? 'visita_cardapio_recorrente' : 'visita_cardapio_nova';
    const eventName = eventType;

    // Persist to Supabase (já inclui visitor_id + session_id automaticamente)
    trackProductEvent({
      product_id: '__menu__',
      product_name: 'Cardápio',
      event_type: eventType,
      price: 0,
      quantity: 1,
    });

    getHashedUid().then(hashedUid => {
      window.fbq?.('trackCustom', eventName, {
        visitor_type: isReturning ? 'returning' : 'new',
        ...(hashedUid ? { external_id: hashedUid } : {}),
      });
    });

    pushDataLayer({
      event: 'visitas_cardapio',
      visit_type: isReturning ? 'recorrente' : 'nova',
      visitor_type: isReturning ? 'returning' : 'new',
    });
  } catch (e) {
    console.error('trackMenuVisit error:', e);
  }
};


/**
 * ViewContent — fired when user opens a product detail / variation dialog.
 */
export const trackViewContent = (item: {
  id: string;
  name: string;
  price: number;
  category?: string;
  tipo?: string;
  permiteCombinacao?: boolean;
}) => {
  try {
    // Persist to Supabase
    trackProductEvent({
      product_id: item.id,
      product_name: item.name,
      event_type: 'view_item',
      price: item.price,
      category: item.category,
    });

    fbqWithUid('track', 'ViewContent', {
      content_ids: [item.id],
      content_name: item.name,
      content_type: 'product',
      content_category: item.category,
      currency: 'BRL',
      value: item.price,
    });

    pushDataLayer({
      event: 'view_item',
      ecommerce: {
        currency: 'BRL',
        value: item.price,
        items: [
          {
            item_id: item.id,
            item_name: item.name,
            item_category: item.category,
            price: item.price,
            item_variant: item.tipo === 'pizza' ? 'pizza' : 'padrao',
          },
        ],
      },
    });
  } catch (e) {
    console.error('trackViewContent error:', e);
  }
};

/**
 * AddToCart — fired when an item is added to cart.
 */
export const trackAddToCart = (data: {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  variations?: Array<{ name?: string; price?: number }>;
  border?: { name: string; price: number };
  isHalfPizza?: boolean;
  combination?: { sabor1: { name: string }; sabor2: { name: string }; tamanho: string };
}) => {
  try {
    // Persist to Supabase
    trackProductEvent({
      product_id: data.id,
      product_name: data.name,
      event_type: 'add_to_cart',
      price: data.price,
      category: data.category,
      quantity: data.quantity,
    });

    const totalValue = data.price * data.quantity;

    fbqWithUid('track', 'AddToCart', {
      content_ids: [data.id],
      content_name: data.name,
      content_type: 'product',
      currency: 'BRL',
      value: totalValue.toFixed(2),
      num_items: data.quantity,
    });

    pushDataLayer({
      event: 'add_to_cart',
      ecommerce: {
        currency: 'BRL',
        value: totalValue,
        items: [
          {
            item_id: data.id,
            item_name: data.name,
            item_category: data.category,
            price: data.price,
            quantity: data.quantity,
            ...(data.isHalfPizza && data.combination
              ? {
                  item_variant: `${data.combination.sabor1.name} / ${data.combination.sabor2.name}`,
                  pizza_size: data.combination.tamanho,
                }
              : {}),
            ...(data.border ? { border_name: data.border.name, border_price: data.border.price } : {}),
            ...(data.variations?.length ? { variations: data.variations } : {}),
          },
        ],
      },
    });
  } catch (e) {
    console.error('trackAddToCart error:', e);
  }
};

/**
 * InitiateCheckout — fired when user clicks "Finalizar Pedido".
 */
export const trackInitiateCheckout = (cartItems: CartItem[], totalValue: number) => {
  try {
    const contentIds = cartItems.map((i) => i.id);
    const numItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);

    // Persist begin_checkout to Supabase (one event per item, mantém visitor_id/session_id)
    if (cartItems.length > 0) {
      trackProductEventsBatch(
        cartItems.map(item => ({
          product_id: item.id,
          product_name: item.name,
          event_type: 'begin_checkout' as const,
          price: item.price,
          category: item.category,
          quantity: item.quantity,
        }))
      );
    }

    fbqWithUid('track', 'InitiateCheckout', {
      content_ids: contentIds,
      content_type: 'product',
      currency: 'BRL',
      value: totalValue.toFixed(2),
      num_items: numItems,
    });

    pushDataLayer({
      event: 'begin_checkout',
      ecommerce: {
        currency: 'BRL',
        value: totalValue,
        items: cartItems.map((item, i) => buildItemPayload(item, i)),
      },
    });
  } catch (e) {
    console.error('trackInitiateCheckout error:', e);
  }
};

/**
 * AbandonedCart — disparado quando o usuário fica >30min na página de checkout sem finalizar.
 */
export const trackAbandonedCart = (cartItems: CartItem[], totalValue: number) => {
  try {
    if (cartItems.length > 0) {
      trackProductEventsBatch(
        cartItems.map(item => ({
          product_id: item.id,
          product_name: item.name,
          event_type: 'abandoned_cart' as const,
          price: item.price,
          category: item.category,
          quantity: item.quantity,
        }))
      );
    }
    fbqWithUid('trackCustom', 'AbandonedCart', {
      content_ids: cartItems.map(i => i.id),
      currency: 'BRL',
      value: totalValue.toFixed(2),
      num_items: cartItems.reduce((s, i) => s + i.quantity, 0),
    });
    pushDataLayer({
      event: 'abandoned_cart',
      ecommerce: {
        currency: 'BRL',
        value: totalValue,
        items: cartItems.map((item, i) => buildItemPayload(item, i)),
      },
    });
  } catch (e) {
    console.error('trackAbandonedCart error:', e);
  }
};

/**
 * CheckoutFinalize — disparado no clique do botão "Finalizar Pedido".
 * Usado para medir o tempo entre abrir o checkout e clicar em finalizar.
 */
export const trackCheckoutFinalize = (cartItems: CartItem[], totalValue: number, durationMs: number) => {
  try {
    if (cartItems.length > 0) {
      trackProductEventsBatch(
        cartItems.map(item => ({
          product_id: item.id,
          product_name: item.name,
          event_type: 'checkout_finalize' as const,
          price: item.price,
          category: item.category,
          quantity: item.quantity,
        }))
      );
    }
    pushDataLayer({
      event: 'checkout_finalize',
      duration_ms: durationMs,
      ecommerce: { currency: 'BRL', value: totalValue },
    });
  } catch (e) {
    console.error('trackCheckoutFinalize error:', e);
  }
};
export const trackViewItemList = (params: {
  listName: string;
  items: Array<{ id: string; name: string; price: number; category?: string }>;
}) => {
  try {
    const { listName, items } = params;

    pushDataLayer({
      event: 'view_item_list',
      ecommerce: {
        item_list_name: listName,
        items: items.map((item, i) => ({
          item_id: item.id,
          item_name: item.name,
          item_category: item.category,
          price: item.price,
          index: i,
        })),
      },
    });
  } catch (e) {
    console.error('trackViewItemList error:', e);
  }
};

/**
 * UpdateCartQuantity — fired when item quantity changes in the cart.
 */
export const trackUpdateCartQuantity = (data: {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  variations?: Array<{ name?: string; price?: number }>;
  border?: { name: string; price: number };
  isHalfPizza?: boolean;
  combination?: { sabor1: { name: string }; sabor2: { name: string }; tamanho: string };
}) => {
  try {
    const totalValue = data.price * data.quantity;

    pushDataLayer({
      event: 'update_cart_quantity',
      ecommerce: {
        currency: 'BRL',
        value: totalValue,
        items: [
          {
            item_id: data.id,
            item_name: data.name,
            item_category: data.category,
            price: data.price,
            quantity: data.quantity,
            ...(data.isHalfPizza && data.combination
              ? {
                  item_variant: `${data.combination.sabor1.name} / ${data.combination.sabor2.name}`,
                  pizza_size: data.combination.tamanho,
                }
              : {}),
            ...(data.border ? { border_name: data.border.name, border_price: data.border.price } : {}),
            ...(data.variations?.length ? { variations: data.variations } : {}),
          },
        ],
      },
    });
  } catch (e) {
    console.error('trackUpdateCartQuantity error:', e);
  }
};

/**
 * UpdateCheckoutQuantity — fired when item quantity/details change in the checkout.
 */
export const trackUpdateCheckoutQuantity = (data: {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
  variations?: Array<{ name?: string; price?: number }>;
  border?: { name: string; price: number };
  isHalfPizza?: boolean;
  combination?: { sabor1: { name: string }; sabor2: { name: string }; tamanho: string };
}) => {
  try {
    const totalValue = data.price * data.quantity;

    pushDataLayer({
      event: 'update_checkout_quantity',
      ecommerce: {
        currency: 'BRL',
        value: totalValue,
        items: [
          {
            item_id: data.id,
            item_name: data.name,
            item_category: data.category,
            price: data.price,
            quantity: data.quantity,
            ...(data.isHalfPizza && data.combination
              ? {
                  item_variant: `${data.combination.sabor1.name} / ${data.combination.sabor2.name}`,
                  pizza_size: data.combination.tamanho,
                }
              : {}),
            ...(data.border ? { border_name: data.border.name, border_price: data.border.price } : {}),
            ...(data.variations?.length ? { variations: data.variations } : {}),
          },
        ],
      },
    });
  } catch (e) {
    console.error('trackUpdateCheckoutQuantity error:', e);
  }
};

/**
 * RemoveFromCart — fired when an item is removed from the cart.
 */
export const trackRemoveFromCart = (data: {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}) => {
  try {
    // Persist to Supabase
    trackProductEvent({
      product_id: data.id,
      product_name: data.name,
      event_type: 'remove_from_cart',
      price: data.price,
      category: data.category,
      quantity: data.quantity,
    });

    const totalValue = data.price * data.quantity;

    pushDataLayer({
      event: 'remove_from_cart',
      ecommerce: {
        currency: 'BRL',
        value: totalValue,
        items: [
          {
            item_id: data.id,
            item_name: data.name,
            item_category: data.category,
            price: data.price,
            quantity: data.quantity,
          },
        ],
      },
    });
  } catch (e) {
    console.error('trackRemoveFromCart error:', e);
  }
};

/**
 * Purchase — fired when the order is successfully created.
 */
export const trackPurchase = (params: {
  orderId: string;
  cartItems: CartItem[];
  total: number;
  subtotal: number;
  frete: number;
  discount: number;
  couponCode?: string | null;
  paymentMethod: string;
}) => {
  try {
    const { orderId, cartItems, total, subtotal, frete, discount, couponCode, paymentMethod } = params;

    // Persist purchase events to Supabase (one per item)
    // Brindes (cupom "compre e ganhe") não devem entrar nas métricas de vendas
    const billableItems = cartItems.filter(
      (it: any) => !it?.__couponGiftId && it?.category !== "brinde"
    );

    trackProductEventsBatch(
      billableItems.map(item => ({
        product_id: item.id,
        product_name: item.name,
        event_type: 'purchase' as const,
        price: item.price,
        category: item.category,
        quantity: item.quantity,
      }))
    );

    const contentIds = cartItems.map((i) => i.id);
    const numItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);

    fbqWithUid('track', 'Purchase', {
      content_ids: contentIds,
      content_type: 'product',
      currency: 'BRL',
      value: total.toFixed(2),
      num_items: numItems,
      order_id: orderId,
    });

    pushDataLayer({
      event: 'purchase',
      ecommerce: {
        transaction_id: orderId,
        currency: 'BRL',
        value: total,
        shipping: frete,
        discount: discount,
        coupon: couponCode || undefined,
        payment_type: paymentMethod,
        items: cartItems.map((item, i) => buildItemPayload(item, i)),
      },
    });
  } catch (e) {
    console.error('trackPurchase error:', e);
  }
};
