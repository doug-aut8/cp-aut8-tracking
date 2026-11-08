type SummaryLoader = (
  start: string,
  end: string,
  source: null,
  campaign: string,
) => Promise<{ totalGiftCost: number }>;

/** Reuses the sales CMV calculation, scoped to the report's main dates and campaign. */
export async function loadCampaignGiftCost(
  start: string,
  end: string,
  campaign: string,
  loadSummary: SummaryLoader,
): Promise<number> {
  if (!start || !end || end < start || !campaign) throw new Error("Informe uma campanha e um período válido.");
  const summary = await loadSummary(start, end, null, campaign);
  if (!Number.isFinite(summary.totalGiftCost) || summary.totalGiftCost < 0) {
    throw new Error("Não foi possível calcular o custo dos brindes.");
  }
  return Math.round(summary.totalGiftCost * 100) / 100;
}

export function campaignInvestmentTotal(mediaCost: number, giftCost: number, includeGifts: boolean): number {
  return Math.round((mediaCost + (includeGifts ? giftCost : 0)) * 100) / 100;
}

export const DEFAULT_INCLUDE_CAMPAIGN_GIFTS = true;

export async function loadCampaignGiftCosts(
  start: string, end: string, campaigns: string[], loadSummary: SummaryLoader,
): Promise<Record<string, number>> {
  const entries = await Promise.all([...new Set(campaigns)].map(async campaign =>
    [campaign, await loadCampaignGiftCost(start, end, campaign, loadSummary)] as const,
  ));
  return Object.fromEntries(entries);
}

export function campaignCostMetrics(mediaCost: number, giftCost: number, includeGifts: boolean, revenue: number, newCustomers: number, avgLtv: number | null) {
  const cost = campaignInvestmentTotal(mediaCost, giftCost, includeGifts);
  const cac = cost > 0 && newCustomers > 0 ? cost / newCustomers : null;
  return {
    mediaCost,
    giftCost: includeGifts ? giftCost : 0,
    cost,
    cac,
    roas: cost > 0 ? revenue / cost : null,
    ltvCac: cac != null && avgLtv != null ? avgLtv / cac : null,
  };
}