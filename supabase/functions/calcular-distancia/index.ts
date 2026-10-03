import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cep_cliente, cep_empresa } = await req.json();

    if (!cep_cliente || !cep_empresa) {
      return new Response(
        JSON.stringify({ error: "CEPs de origem e destino são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("DISTANCE_MATRIX_API_KEY");
    if (!apiKey) {
      console.error("DISTANCE_MATRIX_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key de distância não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `https://api.distancematrix.ai/maps/api/distancematrix/json?origins=CEP:${cep_empresa}&destinations=CEP:${cep_cliente}&key=${apiKey}`;

    console.log("Calling distancematrix.ai for CEPs:", cep_empresa, "->", cep_cliente);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("distancematrix.ai error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao consultar API de distância" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("distancematrix.ai response:", JSON.stringify(data));

    // Extract distance from the response
    const element = data?.rows?.[0]?.elements?.[0];

    if (!element || element.status !== "OK") {
      return new Response(
        JSON.stringify({ error: "Não foi possível calcular a distância entre os CEPs informados" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        distancia_metros: element.distance.value,
        distancia_texto: element.distance.text,
        duracao_texto: element.duration?.text || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in calcular-distancia:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao calcular distância" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
