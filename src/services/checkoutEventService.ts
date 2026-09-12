import { supabase } from "@/integrations/supabase/client";
import { getSessionId, getVisitorId } from "@/utils/sessionId";
import { getUtmParams } from "@/utils/utmCapture";

export type CheckoutEventType =
  | "cupom_aplicado"
  | "cupom_invalido"
  | "checkout_advance";

interface TrackCheckoutEventParams {
  event_type: CheckoutEventType;
  cart_total?: number;
  discount_value?: number;
  cupom_id?: string | null;
  cupom_name?: string | null;
}

/**
 * Persists a checkout event (coupon interactions / checkout progression).
 * Fire-and-forget.
 */
export const trackCheckoutEvent = (params: TrackCheckoutEventParams) => {
  const session_id = getSessionId();
  const visitor_id = getVisitorId();
  const utms = getUtmParams();

  supabase
    .from("checkout_events" as any)
    .insert({
      event_type: params.event_type,
      session_id,
      visitor_id,
      cart_total: params.cart_total ?? 0,
      discount_value: params.discount_value ?? 0,
      cupom_id: params.cupom_id ?? null,
      cupom_name: params.cupom_name ?? null,
      utm_source: utms.utm_source ?? null,
      utm_medium: utms.utm_medium ?? null,
      utm_campaign: utms.utm_campaign ?? null,
      utm_content: utms.utm_content ?? null,
      utm_term: utms.utm_term ?? null,
    })
    .then(({ error }) => {
      if (error) console.error("Error tracking checkout event:", error);
    });
};
