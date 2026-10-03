import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  cupom_id: string;
  firebase_id?: string;
  pedido_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Require authenticated caller — prevents anonymous coupon-usage tampering.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const callerUserId = claimsData.claims.sub as string;

    // Service-role client for privileged writes (RLS bypass).
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { cupom_id, firebase_id, pedido_id } = body;

    // Bind coupon usage to the authenticated user; ignore any firebase_id claim
    // that doesn't match a users row owned by this caller.
    let verifiedFirebaseId: string | undefined;
    if (firebase_id) {
      const { data: ownedRow } = await supabase
        .from("users")
        .select("firebase_id")
        .eq("firebase_id", firebase_id)
        .or(`id.eq.${callerUserId},user_id.eq.${callerUserId}`)
        .maybeSingle();
      if (ownedRow?.firebase_id) verifiedFirebaseId = ownedRow.firebase_id;
    }

    console.log("[registrar-uso-cupom] Recebido:", { cupom_id, firebase_id, pedido_id });

    if (!cupom_id) {
      return new Response(
        JSON.stringify({ success: false, error: "cupom_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Buscar dados atuais do cupom
    const { data: cupom, error: cupomError } = await supabase
      .from("cupons")
      .select("*")
      .eq("id", cupom_id)
      .single();

    if (cupomError || !cupom) {
      console.error("[registrar-uso-cupom] Cupom não encontrado:", cupomError);
      return new Response(
        JSON.stringify({ success: false, error: "Cupom não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[registrar-uso-cupom] Cupom atual:", cupom);

    // 2. Incrementar usos
    const novosUsos = (cupom.usos || 0) + 1;
    const atingiuLimite = cupom.limite_uso && novosUsos >= cupom.limite_uso;

    const updateData: Record<string, any> = { usos: novosUsos };
    if (atingiuLimite) {
      updateData.ativo = false;
    }

    const { error: updateError } = await supabase
      .from("cupons")
      .update(updateData)
      .eq("id", cupom_id);

    if (updateError) {
      console.error("[registrar-uso-cupom] Erro ao atualizar cupom:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao atualizar cupom" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[registrar-uso-cupom] Cupom atualizado - usos:", novosUsos, "atingiu limite:", atingiuLimite);

    // 3. Buscar user_id do Supabase se firebase_id foi fornecido
    let supabaseUserId: string | null = null;
    if (verifiedFirebaseId) {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("firebase_id", verifiedFirebaseId)
        .maybeSingle();

      if (userData && !userError) {
        supabaseUserId = userData.id;
        console.log("[registrar-uso-cupom] User ID encontrado:", supabaseUserId);
      } else {
        console.warn("[registrar-uso-cupom] Usuário não encontrado para firebase_id:", firebase_id);
      }
    }

    // 4. Inserir em cupons_usos (se tiver user_id)
    if (supabaseUserId) {
      const { error: insertError } = await supabase.from("cupons_usos").insert({
        cupom_id,
        user_id: supabaseUserId,
        pedido_id: pedido_id || null,
      });

      if (insertError) {
        console.error("[registrar-uso-cupom] Erro ao inserir em cupons_usos:", insertError);
        // Não retorna erro, pois o incremento principal já foi feito
      } else {
        console.log("[registrar-uso-cupom] Inserido em cupons_usos com sucesso");
      }
    }

    // 5. Marcar cupom-prêmio de fidelidade como resgatado
    if (cupom.origem === "fidelidade") {
      let telefoneCliente: string | null = null;
      if (pedido_id) {
        const { data: pedidoData } = await supabase
          .from("pedidos_sabor_delivery")
          .select("telefone_cliente")
          .eq("id", pedido_id)
          .maybeSingle();
        telefoneCliente = pedidoData?.telefone_cliente || null;
      }
      if (!telefoneCliente && verifiedFirebaseId) {
        const { data: userData } = await supabase
          .from("users")
          .select("phone")
          .eq("firebase_id", verifiedFirebaseId)
          .maybeSingle();
        telefoneCliente = userData?.phone || null;
      }
      if (telefoneCliente) {
        const { error: resgateError } = await supabase
          .from("fidelidade_historico")
          .update({ resgatado: true })
          .eq("cupom_codigo", cupom.nome)
          .eq("telefone_cliente", telefoneCliente)
          .eq("premio_concedido", true);
        if (resgateError) {
          console.error("[registrar-uso-cupom] Erro ao marcar cupom como resgatado:", resgateError);
        } else {
          console.log("[registrar-uso-cupom] Cupom de fidelidade marcado como resgatado");
        }
      }
    }

    // 6. Disparar webhook se atingiu limite
    if (atingiuLimite) {
      console.log("[registrar-uso-cupom] Disparando webhook limite_cupom_alcancado");
      try {
        const webhookResponse = await fetch(
          "https://n8n-n8n-start.yh11mi.easypanel.host/webhook/fidelidade_Aut5",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tipo: "limite_cupom_alcancado",
              cupom: {
                id: cupom.id,
                nome: cupom.nome,
                tipo: cupom.tipo,
                valor: cupom.valor,
                limite_uso: cupom.limite_uso,
                usos: novosUsos,
                data_inicio: cupom.data_inicio,
                data_fim: cupom.data_fim,
              },
              data_alerta: new Date().toISOString(),
            }),
          }
        );
        console.log("[registrar-uso-cupom] Webhook enviado, status:", webhookResponse.status);
      } catch (webhookError) {
        console.error("[registrar-uso-cupom] Erro ao enviar webhook:", webhookError);
        // Não retorna erro, pois o registro principal já foi feito
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        usos: novosUsos,
        atingiu_limite: atingiuLimite,
        cupom_desativado: atingiuLimite,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[registrar-uso-cupom] Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
