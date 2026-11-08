type SummaryLoader = (
  start: string,
  end: string,
  source: null,
  campaign: string,
) => Promise<{ totalGiftCost: number }>;

/** Reuses the sales CMV calculation, scoped to the investment's own dates and campaign. */
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