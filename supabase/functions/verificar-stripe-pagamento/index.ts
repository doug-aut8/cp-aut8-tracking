import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, orderId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .eq("chave", "stripe_secret_key");
    const secretKey = rows?.[0]?.valor;
    if (!secretKey) {
      return new Response(JSON.stringify({ error: "Stripe não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const session = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: session?.error?.message || "Erro Stripe", details: session }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const paid = session.payment_status === "paid";
    const finalOrderId = orderId || session.metadata?.order_id;

    if (paid && finalOrderId) {
      await supabase
        .from("pedidos_sabor_delivery")
        .update({
          payment_status: "recebido",
          atualizado_em: new Date().toISOString(),
          atualizado_em_banco: new Date().toISOString(),
        })
        .eq("id", finalOrderId);
    }

    return new Response(
      JSON.stringify({
        paid,
        payment_status: session.payment_status,
        order_id: finalOrderId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
