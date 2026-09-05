import { supabase } from "@/integrations/supabase/client";

export interface CalculateFreteRequest {
  cepCliente: string;
  cepEmpresa: string;
}

export interface CalculateFreteResponse {
  distanciaKm: number;
  valorFrete: number;
  origem: 'cep_especial' | 'webhook_valor' | 'webhook_distancia';
}

interface WebhookResponse {
  valor?: number;
  distancia?: number;
}

/**
 * Verifica se o CEP é especial e retorna o valor do frete
 */
export async function checkCepEspecial(cep: string): Promise<number | null> {
  try {
    const cleanCep = cep.replace(/\D/g, '');
    
    const { data, error } = await supabase
      .from("ceps_especiais")
      .select("valor")
      .eq("cep", cleanCep)
      .maybeSingle();

    if (error) {
      console.error("Erro ao verificar CEP especial:", error);
      return null;
    }

    return data?.valor ?? null;
  } catch (error) {
    console.error("Erro ao verificar CEP especial:", error);
    return null;
  }
}

/**
 * Calcula o frete baseado na distância entre dois CEPs
 */
export async function calculateFreteByCep(
  cepCliente: string,
  cepEmpresa: string,
  userId: string
): Promise<CalculateFreteResponse> {
  try {
    // Limpar CEPs (remover qualquer formatação)
    const cleanCepCliente = cepCliente.replace(/\D/g, '');
    const cleanCepEmpresa = cepEmpresa.replace(/\D/g, '');

    // 1. Verificar se é CEP especial
    const valorEspecial = await checkCepEspecial(cleanCepCliente);
    if (valorEspecial !== null) {
      return {
        distanciaKm: 0,
        valorFrete: valorEspecial,
        origem: 'cep_especial'
      };
    }

    // 2. Chamar edge function para calcular distância via distancematrix.ai
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
    const publishableKey =
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

    if (!projectId || !publishableKey) {
      throw new Error("Configuração do Supabase incompleta para calcular distância");
    }

    const edgeFunctionUrl = `https://${projectId}.supabase.co/functions/v1/calcular-distancia`;

    const edgeFnResponse = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
      },
      body: JSON.stringify({
        cep_cliente: cleanCepCliente,
        cep_empresa: cleanCepEmpresa,
      }),
    });

    const edgeFnData = await edgeFnResponse.json().catch(() => null);

    if (!edgeFnResponse.ok) {
      console.error("Erro ao chamar edge function calcular-distancia:", {
        status: edgeFnResponse.status,
        data: edgeFnData,
      });
      throw new Error(edgeFnData?.error || "Erro ao consultar distância entre CEPs");
    }

    if (edgeFnData?.error) {
      throw new Error(edgeFnData.error);
    }

    const distanciaMetros = edgeFnData?.distancia_metros;

    if (distanciaMetros === undefined || distanciaMetros === null) {
      throw new Error("Não foi possível calcular a distância. Por favor, tente novamente.");
    }

    console.log("Distância retornada pela API:", distanciaMetros, "metros |", edgeFnData?.distancia_texto);

    // Calcular usando faixas_frete
    const distanciaKm = distanciaMetros / 1000;
    
    console.log("Distância em metros:", distanciaMetros, "| Em km:", distanciaKm);

    // Buscar faixas de frete do usuário
    const { data: faixas, error } = await supabase
      .from("faixas_frete")
      .select("*")
      .eq("user_id", userId)
      .order("km_inicial", { ascending: true });

    if (error) {
      throw error;
    }

    if (!faixas || faixas.length === 0) {
      throw new Error("Nenhuma faixa de frete configurada");
    }

    // Encontrar a faixa correspondente
    const faixaCorrespondente = faixas.find(
      (faixa: any) =>
        distanciaKm >= faixa.km_inicial && distanciaKm <= faixa.km_final
    );

    if (!faixaCorrespondente) {
      throw new Error(
        `Desculpe. A sua localidade não é atendida por nosso delivery`
      );
    }

    return {
      distanciaKm,
      valorFrete: faixaCorrespondente.valor,
      origem: 'webhook_distancia'
    };
  } catch (error) {
    console.error("Erro ao calcular frete por CEP:", error);
    throw error;
  }
}

/**
 * Busca o modelo de frete configurado pela empresa
 */
export type ModeloFrete = "km_direto" | "cep_distancia" | "superfrete";

export async function getModeloFrete(userId: string): Promise<ModeloFrete> {
  try {
    const { data, error } = await supabase
      .from("empresa_info")
      .select("modelo_frete")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao buscar modelo de frete:", error);
      return "km_direto";
    }

    return (data?.modelo_frete as ModeloFrete) || "km_direto";
  } catch (error) {
    console.error("Erro ao buscar modelo de frete:", error);
    return "km_direto";
  }
}

export interface SuperfreteOpcao {
  id: number;
  name: string;
  price: number;
  delivery_time: number | null;
  company: string | null;
}

export interface SuperfreteCalculoRequest {
  cepOrigem: string;
  cepDestino: string;
  itens: Array<{
    weightG?: number | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    quantity: number;
  }>;
  defaults: {
    weightG: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  };
  token: string;
  sandbox: boolean;
  services: number[]; // service IDs
  insuranceValue?: number;
}

/**
 * Calcula frete via Superfrete. Agrega peso e usa a maior dimensão entre os itens
 * (com fallback nos valores padrão configurados em Logística).
 */
export async function calculateFreteSuperfrete(
  req: SuperfreteCalculoRequest
): Promise<SuperfreteOpcao[]> {
  // Agregar pacote: somar peso, dimensões = maior valor entre itens
  let totalWeightG = 0;
  let maxH = 0;
  let maxW = 0;
  let maxL = 0;

  for (const item of req.itens) {
    const qty = item.quantity || 1;
    const w = item.weightG ?? req.defaults.weightG;
    const h = item.heightCm ?? req.defaults.heightCm;
    const wd = item.widthCm ?? req.defaults.widthCm;
    const l = item.lengthCm ?? req.defaults.lengthCm;
    totalWeightG += w * qty;
    if (h > maxH) maxH = h;
    if (wd > maxW) maxW = wd;
    if (l > maxL) maxL = l;
  }

  const pkg = {
    weight: Math.max(totalWeightG / 1000, 0.1), // kg, mínimo 0.1
    height: Math.max(maxH || req.defaults.heightCm, 2),
    width: Math.max(maxW || req.defaults.widthCm, 11),
    length: Math.max(maxL || req.defaults.lengthCm, 16),
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const edgeUrl = `https://${projectId}.supabase.co/functions/v1/calcular-frete-superfrete`;

  const response = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
    },
    body: JSON.stringify({
      cep_origem: req.cepOrigem,
      cep_destino: req.cepDestino,
      token: req.token,
      sandbox: req.sandbox,
      services: req.services.join(","),
      package: pkg,
      insurance_value: req.insuranceValue || 0,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Erro ao calcular frete via Superfrete");
  }

  return (data?.opcoes || []) as SuperfreteOpcao[];
}

