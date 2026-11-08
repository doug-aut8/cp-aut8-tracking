import { supabase } from "@/integrations/supabase/client";

export interface LTVRow {
  utm_source: string;
  customer_count: number;
  total_revenue: number;
  avg_ltv: number;
}

export interface LTVCampaignRow {
  utm_campaign: string;
  customer_count: number;
  total_revenue: number;
  avg_ltv: number;
}

export interface LTVInsight {
  rows: LTVRow[];
  topSource: LTVRow | null;
  insight: string;
}

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toIso = (d?: Date | string | null) =>
  d ? (typeof d === "string" ? d : d.toISOString()) : null;

export const getLTVByUtmSource = async (
  startDate?: Date | string | null,
  endDate?: Date | string | null
): Promise<LTVInsight> => {
  const { data, error } = await supabase.rpc("get_ltv_by_utm_source" as any, {
    start_date: toIso(startDate),
    end_date: toIso(endDate),
  });

  if (error) {
    console.error("Erro ao buscar LTV por origem:", error);
    return { rows: [], topSource: null, insight: "Não foi possível calcular o LTV." };
  }

  const rows = ((data as any[]) || []).map((r) => ({
    utm_source: r.utm_source,
    customer_count: Number(r.customer_count),
    total_revenue: Number(r.total_revenue),
    avg_ltv: Number(r.avg_ltv),
  })) as LTVRow[];

  const topSource = rows.length > 0 ? rows[0] : null;
  const insight = topSource
    ? `A origem "${topSource.utm_source}" tem o maior LTV médio: ${formatBRL(topSource.avg_ltv)}`
    : "Sem dados suficientes para calcular o LTV.";

  return { rows, topSource, insight };
};

export const getLTVByUtmCampaign = async (
  startDate?: Date | string | null,
  endDate?: Date | string | null
): Promise<LTVCampaignRow[]> => {
  const { data, error } = await supabase.rpc("get_ltv_by_utm_campaign" as any, {
    start_date: toIso(startDate),
    end_date: toIso(endDate),
  });

  if (error) {
    console.error("Erro ao buscar LTV por campanha:", error);
    return [];
  }

  return ((data as any[]) || []).map((r) => ({
    utm_campaign: r.utm_campaign,
    customer_count: Number(r.customer_count),
    total_revenue: Number(r.total_revenue),
    avg_ltv: Number(r.avg_ltv),
  }));
};
