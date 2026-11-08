import { supabase } from "@/integrations/supabase/client";
import { fetchSalesSummary } from "@/services/salesAnalyticsService";
import { loadCampaignGiftCost, loadCampaignGiftCosts } from "./campaignInvestmentCalculation";

export const fetchCampaignGiftCost = (start: string, end: string, campaign: string): Promise<number> =>
  loadCampaignGiftCost(start, end, campaign, fetchSalesSummary);

export const fetchCampaignGiftCosts = (start: string, end: string, campaigns: string[]) =>
  loadCampaignGiftCosts(start, end, campaigns, fetchSalesSummary);

export interface CampaignInvestment {
  id: string;
  utm_campaign: string;
  data_inicio: string;
  data_fim: string;
  valor_investido: number;
}

/** Lista investimentos cujo período se sobrepõe ao intervalo informado. */
export const fetchCampaignInvestments = async (
  startDate: string,
  endDate: string,
): Promise<CampaignInvestment[]> => {
  const { data, error } = await supabase
    .from("campanhas_investimentos" as any)
    .select("id, utm_campaign, data_inicio, data_fim, valor_investido")
    .lte("data_inicio", endDate)
    .gte("data_fim", startDate)
    .order("data_inicio", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    utm_campaign: row.utm_campaign,
    data_inicio: row.data_inicio,
    data_fim: row.data_fim,
    valor_investido: Number(row.valor_investido || 0),
  }));
};

/** Lista todos os investimentos de uma campanha específica (para o modal de edição). */
export const fetchInvestmentsByCampaign = async (
  utmCampaign: string,
): Promise<CampaignInvestment[]> => {
  const { data, error } = await supabase
    .from("campanhas_investimentos" as any)
    .select("id, utm_campaign, data_inicio, data_fim, valor_investido")
    .eq("utm_campaign", utmCampaign)
    .order("data_inicio", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    utm_campaign: row.utm_campaign,
    data_inicio: row.data_inicio,
    data_fim: row.data_fim,
    valor_investido: Number(row.valor_investido || 0),
  }));
};

export const saveCampaignInvestment = async (investment: {
  id?: string;
  utm_campaign: string;
  data_inicio: string;
  data_fim: string;
  valor_investido: number;
}): Promise<void> => {
  const payload = {
    utm_campaign: investment.utm_campaign,
    data_inicio: investment.data_inicio,
    data_fim: investment.data_fim,
    // Gift CMV is calculated dynamically in the report, never stored in media spend.
    valor_investido: investment.valor_investido,
  };

  const query = investment.id
    ? supabase.from("campanhas_investimentos" as any).update(payload).eq("id", investment.id)
    : supabase.from("campanhas_investimentos" as any).insert(payload);

  const { error } = await query;
  if (error) throw new Error(error.message);
};

export const deleteCampaignInvestment = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("campanhas_investimentos" as any)
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
};
