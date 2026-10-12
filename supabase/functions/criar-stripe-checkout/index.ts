import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  orderId: string;
  amount: number; // BRL value (e.g. 49.90)
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;

    if (!body.orderId || !body.amount || !body.successUrl || !body.cancelUrl) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows, error } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", ["stripe_enabled", "stripe_secret_key", "stripe_mode"]);

    if (error) throw error;

    const map: Record<string, string> = {};
    (rows || []).forEach((r: any) => (map[r.chave] = r.valor));

    if (map.stripe_enabled !== "true") {
      return new Response(
        JSON.stringify({ error: "Stripe não está habilitado nas configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const secretKey = map.stripe_secret_key;
    if (!secretKey) {
      return new Response(
        JSON.stringify({ error: "Stripe Secret Key não configurada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const currency = (body.currency || "brl").toLowerCase();
    const amountCents = Math.round(Number(body.amount) * 100);
    if (!amountCents || amountCents < 50) {
      return new Response(
        JSON.stringify({ error: "Valor inválido para cobrança." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("success_url", body.successUrl);
    params.append("cancel_url", body.cancelUrl);
    if (body.customerEmail) params.append("customer_email", body.customerEmail);
    params.append("metadata[order_id]", body.orderId);
    params.append("payment_intent_data[metadata][order_id]", body.orderId);

    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", currency);
    params.append("line_items[0][price_data][unit_amount]", String(amountCents));
    params.append(
      "line_items[0][price_data][product_data][name]",
      body.description || `Pedido ${body.orderId.slice(0, 8)}`,
    );

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe error:", session);
      return new Response(
        JSON.stringify({
          error: session?.error?.message || "Erro ao criar sessão Stripe",
          details: session,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Persistir referência no pedido
    try {
      await supabase
        .from("pedidos_sabor_delivery")
        .update({
          observacoes_internas: `stripe_session:${session.id}`,
        })
        .eq("id", body.orderId);
    } catch (_) {
      // coluna pode não existir, ignorar
    }

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("criar-stripe-checkout error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
