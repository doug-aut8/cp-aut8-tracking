import { supabase } from "@/integrations/supabase/client";
import { getSessionId, getVisitorId } from "@/utils/sessionId";
import { withComunicacaoMeta } from "@/utils/webhookPayload";
import { getUtmParams } from "@/utils/utmCapture";

/**
 * Dispara o "Webhook Eventos" quando ocorre um abandoned_cart.
 * Envia todos os eventos da sessão atual + dados do usuário logado.
 */
export const fireAbandonedCartWebhook = async (currentUser: any | null) => {
  try {
    // 1) URL do webhook
    const { data: cfg } = await supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "webhook_eventos")
      .maybeSingle();

    const webhookUrl = cfg?.valor;
    if (!webhookUrl) {
      console.warn("⚠️ Webhook Eventos não configurado. Pulando envio.");
      return;
    }

    const sessionId = getSessionId();
    const visitorId = getVisitorId?.() || null;

    // 2) Todos os eventos da sessão
    const { data: sessionEvents } = await supabase
      .from("product_events")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    // 3) Dados do usuário logado (perfil completo)
    let userProfile: any = null;
    if (currentUser?.uid) {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("firebase_id", currentUser.uid)
        .maybeSingle();
      userProfile = data || null;
    }

    const userPayload = currentUser
      ? {
          firebase_id: currentUser.uid || null,
          email: currentUser.email || userProfile?.email || null,
          name: currentUser.displayName || userProfile?.name || null,
          phone: currentUser.phoneNumber || userProfile?.phone || null,
          profile: userProfile,
        }
      : null;

    const payload = {
      event: "abandoned_cart",
      session_id: sessionId,
      visitor_id: visitorId,
      occurred_at: new Date().toISOString(),
      utm: getUtmParams?.() || null,
      user: userPayload,
      events: sessionEvents || [],
      events_count: sessionEvents?.length || 0,
    };

    const enriched = await withComunicacaoMeta(payload);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enriched),
    });

    if (!res.ok) {
      console.error("❌ Falha ao enviar Webhook Eventos:", await res.text());
    } else {
      console.log("✅ Webhook Eventos (abandoned_cart) enviado.");
    }
  } catch (err) {
    console.error("⚠️ Erro ao disparar Webhook Eventos:", err);
  }
};
