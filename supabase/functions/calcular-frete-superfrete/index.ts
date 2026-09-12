import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  cep_origem: string;
  cep_destino: string;
  token: string;
  sandbox?: boolean;
  services?: string; // comma-separated service IDs e.g. "1,2,17"
  package: {
    height: number;
    width: number;
    length: number;
    weight: number; // kg
  };
  insurance_value?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (!body.cep_origem || !body.cep_destino || !body.token || !body.package) {
      return new Response(
        JSON.stringify({
          error: "Parâmetros obrigatórios: cep_origem, cep_destino, token, package",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl = body.sandbox
      ? "https://sandbox.superfrete.com"
      : "https://api.superfrete.com";

    const url = `${baseUrl}/api/v0/calculator`;

    const payload = {
      from: { postal_code: body.cep_origem.replace(/\D/g, "") },
      to: { postal_code: body.cep_destino.replace(/\D/g, "") },
      services: body.services || "1,2,17",
      options: {
        own_hand: false,
        receipt: false,
        insurance_value: body.insurance_value || 0,
        use_insurance_value: !!body.insurance_value,
      },
      package: {
        height: Number(body.package.height) || 2,
        width: Number(body.package.width) || 11,
        length: Number(body.package.length) || 16,
        weight: Number(body.package.weight) || 0.3,
      },
    };

    console.log("Superfrete request:", JSON.stringify(payload));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${body.token}`,
        "User-Agent": "Lovable App (contato@lovable.dev)",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    console.log("Superfrete response status:", response.status);
    console.log("Superfrete response body:", JSON.stringify(data));

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error:
            data?.message ||
            data?.error ||
            "Erro ao consultar API do Superfrete",
          status: response.status,
          details: data,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalizar resposta: somente serviços sem erro
    const opcoes = Array.isArray(data)
      ? data
          .filter((s: any) => !s.error && s.price)
          .map((s: any) => ({
            id: s.id,
            name: s.name,
            price: parseFloat(s.price ?? s.custom_price ?? "0"),
            delivery_time: s.delivery_time ?? s.custom_delivery_time ?? null,
            company: s.company?.name ?? null,
          }))
      : [];

    return new Response(
      JSON.stringify({ opcoes, raw: data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro em calcular-frete-superfrete:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
