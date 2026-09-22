import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { schedule } = await req.json();

    if (!schedule || typeof schedule !== "string") {
      return new Response(
        JSON.stringify({ error: "Campo 'schedule' é obrigatório (ex: '0 9 * * *')" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parts = schedule.trim().split(/\s+/);
    if (parts.length !== 5) {
      return new Response(
        JSON.stringify({ error: "Expressão cron inválida. Use 5 campos: minuto hora dia mês dia_semana" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await supabase.rpc("execute_cron_update", {
      cron_expression: schedule,
      function_url: `${supabaseUrl}/functions/v1/ga4-analytics`,
      anon_key: anonKey,
    });

    if (error) {
      console.error("Erro ao atualizar cron:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar cron", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, schedule, message: `Cron atualizado para: ${schedule}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
